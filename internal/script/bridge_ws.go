package script

import (
	"fmt"
	"time"

	"github.com/dop251/goja"
)

// jsWaitForEvent blocks execution until a specific WebSocket event is received 
// or the timeout is reached.
func (a *Agent) jsWaitForEvent(eventName string, timeoutMs int) (interface{}, error) {

	start := time.Now()
	for {
		// Check for already buffered data in Listener
		if data, err := a.Listener.WaitForData(a.Ctx, eventName, 10); err == nil {
			return data, nil
		}

		a.jsProcessEvents()

		if time.Since(start) > time.Duration(timeoutMs)*time.Millisecond {
			return nil, fmt.Errorf("timeout waiting for event: %s", eventName)
		}

		select {
		case <-a.Ctx.Done():
			return nil, a.Ctx.Err()
		case <-time.After(10 * time.Millisecond):
		}
	}
}

// --- WebSocket Control Methods ---

// jsWsConnect triggers the underlying WebSocket connection process.
func (a *Agent) jsWsConnect() {

	a.Listener.Connect()
}

// jsWsDisconnect forcefully closes the WebSocket connection.
func (a *Agent) jsWsDisconnect() {

	a.Listener.Disconnect()
}

// jsWsStatus returns a map containing the current connectivity state. The
// socket_id key is kept for script compatibility and now carries the SSE
// replay cursor (last event id).
func (a *Agent) jsWsStatus() interface{} {

	conn, lastEventID, subs := a.Listener.Status()
	return map[string]interface{}{
		"connected":     conn,
		"socket_id":     lastEventID,
		"subscriptions": subs,
	}
}

// jsWsSubscribe requests a subscription to a specific private or public channel.
func (a *Agent) jsWsSubscribe(channel string) {

	a.Listener.Subscribe(channel)
}

// jsWsIsSubscribed checks if the server has acknowledged a subscription to the given channel.
func (a *Agent) jsWsIsSubscribed(channel string) bool {

	return a.Listener.IsSubscribed(channel)
}

// --- Callback System Methods ---

// jsOnEvent registers a JS callback to be executed whenever a specific event is received.
func (a *Agent) jsOnEvent(eventName string, cb goja.Callable) {

	a.cbMu.Lock()
	defer a.cbMu.Unlock()
	a.eventCallbacks[eventName] = append(a.eventCallbacks[eventName], cb)
}

// jsProcessEvents drains the internal event queue and executes all registered callbacks.
func (a *Agent) jsProcessEvents() {

	// We must drain the queue and execute callbacks
	for {
		select {
		case ev := <-a.eventQueue:
			a.cbMu.Lock()
			callbacks := a.eventCallbacks[ev.Name]
			a.cbMu.Unlock()

			for _, cb := range callbacks {
				// We don't want a panic in a callback to crash the agent
				func() {
					defer func() {
						if r := recover(); r != nil {
							a.jsLog(fmt.Sprintf("ERROR in callback for %s: %v", ev.Name, r))
						}
					}()
					cb(goja.Undefined(), a.VM.ToValue(ev.Data))
				}()
			}
		default:
			return
		}
	}
}
