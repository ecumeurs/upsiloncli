// Package ws maintains the CLI's realtime link. It historically spoke the
// Pusher/Reverb websocket protocol; since the hub migration it consumes the
// hub's Server-Sent Events stream (GET /api/v1/events), which carries the
// same envelope-wrapped events (match.found, board.updated, turn.started,
// game.started, game.ended, ...). The stream is bearer-authenticated, so the
// connection itself is the user's private channel: there are no channel
// subscriptions and no broadcasting/auth handshake anymore.
package ws

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/ecumeurs/upsiloncli/internal/api"
	"github.com/ecumeurs/upsiloncli/internal/display"
	"github.com/ecumeurs/upsiloncli/internal/dto"
	"github.com/ecumeurs/upsiloncli/internal/session"
)

// streamPath is the hub's SSE endpoint.
const streamPath = "/api/v1/events"

// reconnectBase/reconnectCap bound the retry backoff between stream attempts.
const (
	reconnectBase = time.Second
	reconnectCap  = 10 * time.Second
)

// Listener manages the real-time SSE connection to the hub.
type Listener struct {
	Client  *api.Client
	Session *session.Session
	Printer *display.Printer

	// stream is a dedicated HTTP client: the shared api.Client carries a 30s
	// timeout that would sever a long-lived event stream.
	stream *http.Client

	mu          sync.Mutex
	cancel      context.CancelFunc
	connected   bool
	identity    string // session identity the running stream serves
	lastEventID string // replay cursor echoed as Last-Event-ID on reconnect

	waitMu  sync.Mutex
	waiters map[string][]chan interface{}
	buffer  map[string][]interface{}
	hooks   []func(string, interface{})
	hooksMu sync.Mutex
}

// NewListener creates a new SSE listener.
func NewListener(client *api.Client, sess *session.Session, printer *display.Printer) *Listener {
	return &Listener{
		Client:  client,
		Session: sess,
		Printer: printer,
		stream:  &http.Client{},
		waiters: make(map[string][]chan interface{}),
		buffer:  make(map[string][]interface{}),
	}
}

// Connect starts the stream if the session allows it.
func (l *Listener) Connect() {
	l.Start()
}

// Disconnect stops the stream.
func (l *Listener) Disconnect() {
	l.Stop()
}

// Subscribe is kept for the script bridge: the SSE stream has no channels
// (being connected is the subscription), so this only ensures the stream is up.
func (l *Listener) Subscribe(channel string) {
	l.Sync()
}

// AddHook registers a callback for every received event.
func (l *Listener) AddHook(h func(string, interface{})) {
	l.hooksMu.Lock()
	defer l.hooksMu.Unlock()
	l.hooks = append(l.hooks, h)
}

// Start reconciles the stream with the session — before authentication there
// is nothing to connect (the endpoint requires a bearer token).
func (l *Listener) Start() {
	l.Sync()
}

// Stop terminates the stream.
func (l *Listener) Stop() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.stopLocked()
}

// stopLocked cancels the running stream loop. Caller holds l.mu.
func (l *Listener) stopLocked() {
	if l.cancel != nil {
		l.cancel()
		l.cancel = nil
	}
	l.connected = false
	l.identity = ""
}

// streamIdentity is what a running stream is keyed on: the user id when known,
// else the raw token. Token renewal keeps the identity stable — the stream
// survives it — while switching accounts (adminSection) changes it and forces
// a reconnect as the new user.
func (l *Listener) streamIdentity() string {
	if uid, ok := l.Session.Get("user_id"); ok && uid != "" {
		return uid
	}
	return l.Session.Token()
}

// Sync reconciles the stream with the current session state: connected while
// a token is held, torn down on logout, reconnected when the authenticated
// user changes. Replaces the old channel-subscription reconciliation.
func (l *Listener) Sync() {
	if l.Session.Token() == "" {
		l.Stop()
		return
	}
	want := l.streamIdentity()

	l.mu.Lock()
	if l.cancel != nil && l.identity == want {
		l.mu.Unlock()
		return
	}
	l.stopLocked()
	ctx, cancel := context.WithCancel(context.Background())
	l.cancel = cancel
	l.identity = want
	l.mu.Unlock()

	go l.run(ctx)
}

// Status returns the current health of the listener. The second value is the
// replay cursor (last SSE event id) — the closest analogue to the old socket
// id — and there are no channel subscriptions anymore.
func (l *Listener) Status() (connected bool, lastEventID string, subscriptions []string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.connected, l.lastEventID, nil
}

// IsConnected reports whether the event stream is live.
func (l *Listener) IsConnected() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.connected
}

// IsSubscribed is kept for the script bridge: the authenticated stream is the
// subscription, so any channel is "subscribed" exactly when the stream is live.
func (l *Listener) IsSubscribed(channel string) bool {
	return l.IsConnected()
}

// run is the stream loop: connect, relay frames until the stream drops, then
// retry with backoff (resetting it after any healthy connection) until the
// listener is stopped or resynced.
func (l *Listener) run(ctx context.Context) {
	backoff := reconnectBase
	for ctx.Err() == nil {
		healthy := l.streamOnce(ctx)
		l.setConnected(ctx, false)
		if ctx.Err() != nil {
			return
		}
		if healthy {
			backoff = reconnectBase
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		if backoff < reconnectCap {
			backoff *= 2
		}
	}
}

// streamOnce opens one SSE connection and relays its frames until it ends.
// Output: whether a stream was established (drives the retry backoff).
//
// @spec-link [[api_websocket_game_events]]
func (l *Listener) streamOnce(ctx context.Context) bool {
	token := l.Session.Token()
	if token == "" {
		return false
	}

	url := l.Client.BaseURL + streamPath
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		if l.Printer != nil {
			l.Printer.Warn(fmt.Sprintf("SSE request build failed: %v", err))
		}
		return false
	}
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Authorization", "Bearer "+token)
	l.mu.Lock()
	if l.lastEventID != "" {
		req.Header.Set("Last-Event-ID", l.lastEventID)
	}
	l.mu.Unlock()

	if l.Printer != nil {
		l.Printer.Curl("GET", url, req.Header, nil)
	}

	resp, err := l.stream.Do(req)
	if err != nil {
		if ctx.Err() == nil && l.Printer != nil {
			l.Printer.Warn(fmt.Sprintf("SSE connection failed (is the hub running?): %v", err))
		}
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		if l.Printer != nil {
			l.Printer.Warn(fmt.Sprintf("SSE connect rejected (Status %d): %s", resp.StatusCode, string(body)))
		}
		return false
	}

	l.setConnected(ctx, true)
	if l.Printer != nil {
		l.Printer.System("Realtime link established (SSE stream live).")
	}
	l.readFrames(resp.Body)
	return true
}

// setConnected records stream liveness unless the loop was cancelled (a stale
// goroutine must not resurrect state a newer Sync owns).
func (l *Listener) setConnected(ctx context.Context, v bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if ctx.Err() != nil {
		return
	}
	l.connected = v
}

// readFrames parses text/event-stream framing off the response body and
// dispatches each complete frame; comment lines (": connected", ": hb") are
// liveness only. Returns when the stream ends.
func (l *Listener) readFrames(body io.Reader) {
	r := bufio.NewReader(body)
	var event, id string
	var data []string
	for {
		line, err := r.ReadString('\n')
		if len(line) > 0 {
			line = strings.TrimRight(line, "\r\n")
			switch {
			case line == "":
				if len(data) > 0 {
					l.handleFrame(event, id, strings.Join(data, "\n"))
				}
				event, id, data = "", "", nil
			case strings.HasPrefix(line, ":"):
				// heartbeat / opening comment
			default:
				field, value, _ := strings.Cut(line, ":")
				value = strings.TrimPrefix(value, " ")
				switch field {
				case "event":
					event = value
				case "data":
					data = append(data, value)
				case "id":
					id = value
				}
			}
		}
		if err != nil {
			return
		}
	}
}

// handleFrame advances the replay cursor and dispatches one complete frame.
func (l *Listener) handleFrame(eventName, id, data string) {
	if id != "" {
		l.mu.Lock()
		l.lastEventID = id
		l.mu.Unlock()
	}
	if eventName == "" {
		eventName = "message"
	}
	l.dispatch(eventName, json.RawMessage(data))
}

// dispatch routes one event to its specialized handler and then to waiters
// and hooks — the SSE port of the old websocket message loop.
//
// @spec-link [[api_websocket_game_events]]
func (l *Listener) dispatch(eventName string, raw json.RawMessage) {
	switch eventName {
	case "match.found":
		if l.handleMatchFound(eventName, raw) {
			return // waiters are notified after session hydration
		}
	case "board.updated", "turn.started", "game.started":
		l.handleBoardEvent(eventName, raw)
	default:
		// Print all other events for transparency
		if l.Printer != nil {
			l.Printer.WebSocket(eventName, raw)
		}
	}
	l.notifyWaiters(eventName, raw)
}

// handleMatchFound stores the match id and hydrates the tactical session in
// the background before notifying waiters, so the bot wakes to a populated
// arena. Output: whether the deferred notification path was taken.
func (l *Listener) handleMatchFound(eventName string, raw json.RawMessage) bool {
	data, err := l.unwrapEnvelope(raw)
	if err != nil {
		if l.Printer != nil {
			l.Printer.Warn(fmt.Sprintf("match.found envelope error: %v", err))
		}
		return false
	}

	var payload struct {
		MatchID string `json:"match_id"`
	}
	dataBytes, _ := json.Marshal(data)
	if err := json.Unmarshal(dataBytes, &payload); err != nil || payload.MatchID == "" {
		if l.Printer != nil {
			l.Printer.Warn(fmt.Sprintf("Received match.found but match_id is missing or malformed. Raw: %s", string(raw)))
		}
		return false
	}

	l.Session.Set("match_id", payload.MatchID)
	if l.Printer != nil {
		l.Printer.WebSocket("MatchFound", raw)
		l.Printer.System(fmt.Sprintf("Match detected! Initializing arena %s...", payload.MatchID))
	}

	// Perform tactical setup in background to avoid blocking the stream loop;
	// waiters are notified only once the session holds the participants.
	go func(matchID string) {
		l.initializeMatch(matchID)
		l.notifyWaiters(eventName, raw)
	}(payload.MatchID)
	return true
}

// handleBoardEvent applies one tactical update to the session (decorated
// board, participants) and renders it.
func (l *Listener) handleBoardEvent(eventName string, raw json.RawMessage) {
	if l.Printer != nil {
		l.Printer.WebSocket(eventName, raw)
	}

	data, err := l.unwrapEnvelope(raw)
	if err != nil {
		if l.Printer != nil {
			l.Printer.Warn(fmt.Sprintf("%s envelope error: %v", eventName, err))
		}
		return
	}

	var payload dto.BoardState
	dataBytes, _ := json.Marshal(data)
	if err := json.Unmarshal(dataBytes, &payload); err != nil {
		if l.Printer != nil {
			l.Printer.Warn(fmt.Sprintf("Failed to decode %s payload: %v", eventName, err))
		}
		return
	}

	l.decorateBoard(&payload)
	l.Session.SetParticipants(payload.Players)
	l.Session.SetLastBoard(&payload)
	if l.Printer != nil {
		l.Printer.System("Tactical feed updated.")
		if payload.GameFinished {
			if payload.WinnerIsSelf {
				name, _ := l.Session.Get("account_name")
				l.Printer.Victory(name)
			} else if payload.WinnerTeamID != nil {
				l.Printer.Defeat(fmt.Sprintf("Team %d", *payload.WinnerTeamID))
			} else {
				l.Printer.Draw()
			}
		} else {
			l.Printer.Board(&payload, l.Session.UserIdentifier(), l.Session.Participants())
			l.Printer.Suggestions([]string{"redraw"})
		}
	}
}

// WaitForData blocks until an event of the given name is received or context is cancelled.
func (l *Listener) WaitForData(ctx context.Context, eventName string, timeoutMs int) (interface{}, error) {
	data, _, err := l.WaitForAnyData(ctx, []string{eventName}, timeoutMs)
	return data, err
}

// WaitForAnyData blocks until any of the given event names is received or context is cancelled.
// It returns the data RECEIVED, the NAME of the event that triggered, and any error.
func (l *Listener) WaitForAnyData(ctx context.Context, eventNames []string, timeoutMs int) (interface{}, string, error) {
	ch := make(chan struct {
		name string
		data interface{}
	}, 1)

	l.waitMu.Lock()
	// Check buffer first
	for _, name := range eventNames {
		if b, ok := l.buffer[name]; ok && len(b) > 0 {
			data := b[0]
			l.buffer[name] = b[1:]
			l.waitMu.Unlock()
			return data, name, nil
		}
	}

	waiterChans := make(map[string]chan interface{})
	for _, name := range eventNames {
		w := make(chan interface{}, 1)
		waiterChans[name] = w
		l.waiters[name] = append(l.waiters[name], w)

		nameCaptured := name
		go func(n string, w chan interface{}) {
			select {
			case d := <-w:
				select {
				case ch <- struct {
					name string
					data interface{}
				}{n, d}:
				default:
				}
			case <-ctx.Done():
			}
		}(nameCaptured, w)
	}
	l.waitMu.Unlock()

	defer func() {
		l.waitMu.Lock()
		defer l.waitMu.Unlock()
		for name, w := range waiterChans {
			list := l.waiters[name]
			for i, v := range list {
				if v == w {
					l.waiters[name] = append(list[:i], list[i+1:]...)
					break
				}
			}
		}
	}()

	select {
	case res := <-ch:
		return res.data, res.name, nil
	case <-ctx.Done():
		return nil, "", ctx.Err()
	case <-time.After(time.Duration(timeoutMs) * time.Millisecond):
		return nil, "", fmt.Errorf("timeout waiting for events: %v", eventNames)
	}
}

// unwrapEnvelope extracts the 'data' field from a [[api_standard_envelope]].
func (l *Listener) unwrapEnvelope(raw json.RawMessage) (interface{}, error) {
	var envelope struct {
		Success bool        `json:"success"`
		Message string      `json:"message"`
		Data    interface{} `json:"data"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("malformed envelope: %v", err)
	}
	if !envelope.Success {
		return nil, fmt.Errorf("server error: %s", envelope.Message)
	}
	return envelope.Data, nil
}

// notifyWaiters dispatches a received event to any active blockers (WaitForData)
// and triggers registered hooks.
func (l *Listener) notifyWaiters(eventName string, data json.RawMessage) {
	l.waitMu.Lock()
	defer l.waitMu.Unlock()

	// Parse into interface{} for JS
	var parsed interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		if l.Printer != nil {
			l.Printer.Warn(fmt.Sprintf("Failed to parse event data for JS: %v", err))
		}
		return
	}

	waiters, ok := l.waiters[eventName]
	if !ok || len(waiters) == 0 {
		// No one is waiting, buffer it
		if l.buffer == nil {
			l.buffer = make(map[string][]interface{})
		}
		l.buffer[eventName] = append(l.buffer[eventName], parsed)
	} else {
		for _, ch := range waiters {
			select {
			case ch <- parsed:
			default: // skip if channel is full
			}
		}
	}

	// Always trigger hooks regardless of whether the event was buffered or dispatched.
	l.hooksMu.Lock()
	for _, h := range l.hooks {
		h(eventName, parsed)
	}
	l.hooksMu.Unlock()
}

// initializeMatch hydrates the local session state with full match details
// (grid, players) when a match is first discovered.
func (l *Listener) initializeMatch(matchID string) {

	// Call GET /api/v1/game/{id}
	resp, err := l.Client.Get(fmt.Sprintf("/api/v1/game/%s", matchID))
	if err != nil {
		return
	}

	var game dto.GameResponse
	dataBytes, _ := json.Marshal(resp.Data)
	if err := json.Unmarshal(dataBytes, &game); err == nil {
		l.Session.SetParticipants(game.GameState.Players)
		l.decorateBoard(&game.GameState)
		l.Session.SetLastBoard(&game.GameState)
	}
}

// decorateBoard re-hydrates semantic identity flags
func (l *Listener) decorateBoard(bs *dto.BoardState) {
	players := bs.Players
	if len(players) == 0 {
		players = l.Session.Participants()
	}

	// Create lookup of owned character IDs
	ownedIDs := make(map[string]bool)
	for _, p := range players {
		if p.IsSelf {
			for _, e := range p.Entities {
				ownedIDs[e.ID] = true
			}
			break
		}
	}

	// 1. Decorate Current Turn
	bs.CurrentPlayerIsSelf = ownedIDs[bs.CurrentEntityID]
}
