package script

import (
	"fmt"
	"time"

	"github.com/dop251/goja"
)

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

func (a *Agent) jsWsConnect() {
	a.Listener.Connect()
}

func (a *Agent) jsWsDisconnect() {
	a.Listener.Disconnect()
}

func (a *Agent) jsWsStatus() interface{} {
	conn, sid, subs := a.Listener.Status()
	return map[string]interface{}{
		"connected":     conn,
		"socket_id":     sid,
		"subscriptions": subs,
	}
}

func (a *Agent) jsWsSubscribe(channel string) {
	a.Listener.Subscribe(channel)
}

func (a *Agent) jsWsIsSubscribed(channel string) bool {
	return a.Listener.IsSubscribed(channel)
}

// --- Callback System Methods ---

func (a *Agent) jsOnEvent(eventName string, cb goja.Callable) {
	a.cbMu.Lock()
	defer a.cbMu.Unlock()
	a.eventCallbacks[eventName] = append(a.eventCallbacks[eventName], cb)
}

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
