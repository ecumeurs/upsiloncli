// Package session manages JWT tokens and contextual state
// accumulated from API responses during a CLI session.
package session

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"

	"github.com/ecumeurs/upsiloncli/internal/dto"
)

// SessionData is the serializable part of the session.
type SessionData struct {
	Token        string            `json:"token"`
	WSChannelKey string            `json:"ws_channel_key"`
	Context      map[string]string `json:"context"`
	Participants []dto.Player           `json:"participants"`
}

// Session holds the active JWT and a key-value context store
// populated from API response data (user_id, match_id, etc.).
type Session struct {
	mu           sync.RWMutex
	token        string
	wsChannelKey string
	context      map[string]string
	lastBoard    *dto.BoardState
	participants []dto.Player
}

// New creates an empty session.
func New() *Session {
	return &Session{
		context: make(map[string]string),
	}
}

// --- JWT & Key Management ---

// SetToken stores a new JWT. Called after login/register or renewal.
func (s *Session) SetToken(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.token = token
}

// SetWSChannelKey stores the private WS pseudonym.
func (s *Session) SetWSChannelKey(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.wsChannelKey = key
}

// WSChannelKey returns the private WS pseudonym.
func (s *Session) WSChannelKey() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.wsChannelKey
}

// Token returns the current JWT (empty string if unauthenticated).
func (s *Session) Token() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.token
}

// ClearToken wipes the JWT. Called on logout or account deletion.
func (s *Session) ClearToken() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.token = ""
}

// HasToken returns true if a JWT is currently cached.
func (s *Session) HasToken() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.token != ""
}

// --- Context Store ---

// Set stores a named value in the session context.
// Values are typically extracted from API responses (e.g., "user_id", "match_id").
func (s *Session) Set(key, value string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.context[key] = value
}

// Get retrieves a value from the session context.
// Returns the value and whether it was found.
func (s *Session) Get(key string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, ok := s.context[key]
	return v, ok
}

// Delete removes a key from the session context.
func (s *Session) Delete(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.context, key)
}

// Clear wipes the entire context (but preserves the JWT).
func (s *Session) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.context = make(map[string]string)
}

// ClearAll wipes both the JWT and the context.
func (s *Session) ClearAll() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.token = ""
	s.wsChannelKey = ""
	s.context = make(map[string]string)
	s.lastBoard = nil
	s.participants = nil
}

// --- Tactical State ---

// SetLastBoard updates the cached tactical board.
func (s *Session) SetLastBoard(board *dto.BoardState) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastBoard = board
	if board != nil && board.CurrentEntityID != "" {
		s.context["current_entity_id"] = board.CurrentEntityID
	}
}

// LastBoard returns the cached tactical board.
func (s *Session) LastBoard() *dto.BoardState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastBoard
}

// SetParticipants store the team mapping for the current match.
func (s *Session) SetParticipants(participants []dto.Player) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.participants = participants
}

// Participants returns the current match participants.
func (s *Session) Participants() []dto.Player {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.participants
}

// UserID returns the current user UUID.
func (s *Session) UserID() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.context["user_id"]
}

// UserIdentifier returns either the user_id (UUID) or account_name (Nickname).
// This is used for matching against match participants.
func (s *Session) UserIdentifier() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if id := s.context["user_id"]; id != "" {
		return id
	}
	return s.context["account_name"]
}

// Dump returns a snapshot of the session for display.
func (s *Session) Dump() map[string]string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string]string, len(s.context)+1)
	if s.token != "" {
		// Show only the last 12 chars for security
		if len(s.token) > 12 {
			out["jwt"] = "..." + s.token[len(s.token)-12:]
		} else {
			out["jwt"] = s.token
		}
	} else {
		out["jwt"] = "(none)"
	}
	for k, v := range s.context {
		out[k] = v
	}
	return out
}

// HandleTokenRenewal checks a response envelope for meta.token
// and transparently rotates the JWT if present.
// Returns true if a renewal occurred.
func (s *Session) HandleTokenRenewal(meta map[string]interface{}) bool {
	if meta == nil {
		return false
	}
	tokenRaw, ok := meta["token"]
	if !ok {
		return false
	}
	newToken, ok := tokenRaw.(string)
	if !ok || newToken == "" {
		return false
	}
	s.SetToken(newToken)
	return true
}

// String returns a concise session summary for the prompt.
func (s *Session) String() string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	accountName, _ := s.context["account_name"]
	userID, _ := s.context["user_id"]
	matchID, _ := s.context["match_id"]

	displayUser := accountName
	if displayUser == "" {
		displayUser = userID
	}

	auth := "✗"
	if s.token != "" {
		auth = "✓"
	}

	return fmt.Sprintf("auth:%s user:%s match:%s", auth, valueOrDash(displayUser), valueOrDash(matchID))
}

func valueOrDash(v string) string {
	if v == "" {
		return "-"
	}
	if len(v) > 8 {
		return v[:8]
	}
	return v
}

// SaveToFile exports the session to a JSON file.
func (s *Session) SaveToFile(path string) error {
	s.mu.RLock()
	data := SessionData{
		Token:        s.token,
		WSChannelKey: s.wsChannelKey,
		Context:      s.context,
		Participants: s.participants,
	}
	s.mu.RUnlock()

	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, bytes, 0600)
}

// LoadFromFile imports the session from a JSON file.
func (s *Session) LoadFromFile(path string) error {
	bytes, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	var data SessionData
	if err := json.Unmarshal(bytes, &data); err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.token = data.Token
	s.wsChannelKey = data.WSChannelKey
	s.context = data.Context
	s.participants = data.Participants
	if s.context == nil {
		s.context = make(map[string]string)
	}
	return nil
}

