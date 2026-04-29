package script

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/ecumeurs/upsiloncli/internal/endpoint"
)

func (a *Agent) bindJSAPI() {
	upsilonObj := map[string]interface{}{
		"call":         a.jsCall,
		"waitForEvent": a.jsWaitForEvent,
		"getContext":   a.jsGetContext,
		"setContext":   a.jsSetContext,
		"log":          a.jsLog,

		// New lifecycle and assertion methods
		"onTeardown":   a.jsOnTeardown,
		"assert":       a.jsAssert,
		"assertResponse": a.jsAssertResponse,

		// New Shared State Methods
		"setShared": a.jsSetShared,
		"getShared": a.jsGetShared,

		// New Flow Control Methods
		"sleep": a.jsSleep,

		// Pathfinding
		"findPath":         a.jsFindPath,
		"planTravelToward": a.jsPlanTravelToward,

		// Environment
		"getEnv":            a.jsGetEnv,
		"getAgentIndex":     a.jsGetAgentIndex,
		"getAgentCount":     a.jsGetAgentCount,

		// Tactical Helpers
		"myPlayer":            a.jsMyPlayer,
		"currentPlayer":       a.jsCurrentPlayer,
		"currentCharacter":    a.jsCurrentCharacter,
		"myCharacters":        a.jsMyCharacters,
		"myAllies":            a.jsMyAllies,
		"myAlliesCharacters":  a.jsMyAlliesCharacters,
		"myFoes":              a.jsMyFoes,
		"myFoesCharacters":    a.jsMyFoesCharacters,
		"cellContentAt":       a.jsCellContentAt,
		"cellAt":              a.jsCellAt,
		"forEachCell":         a.jsForEachCell,
		"autoBattleTurn":      a.jsAutoBattleTurn,

		// Tactical Distance/Height Helpers
		"distance2D":             a.jsDistance2D,
		"heightDifference":      a.jsHeightDifference,
		"activeHeightDifference": a.jsActiveHeightDifference,

		// High-level Lifecycle Helpers
		"bootstrapBot":      a.jsBootstrapBot,
		"joinWaitMatch":     a.jsJoinWaitMatch,
		"humanDelay":        a.jsHumanDelay,
		"registrationDelay": a.jsRegistrationDelay,
		"waitNextTurn":      a.jsWaitNextTurn,
		"syncGroup":         a.jsSyncGroup,
		"joinQueue":         a.jsJoinQueue,
		"waitForMatch":      a.jsWaitForMatch,
		"adminSection":      a.jsAdminSection,

		// Advanced Assertions
		"assertEquals": a.jsAssertEquals,
		"assertState": a.jsAssertState,

		// New WebSocket control
		"wsConnect":      a.jsWsConnect,
		"wsDisconnect":   a.jsWsDisconnect,
		"wsStatus":       a.jsWsStatus,
		"wsSubscribe":    a.jsWsSubscribe,
		"wsIsSubscribed": a.jsWsIsSubscribed,

		// Callback system
		"onEvent":       a.jsOnEvent,
		"processEvents": a.jsProcessEvents,
	}
	a.VM.Set("upsilon", upsilonObj)
}

func (a *Agent) jsLog(msg interface{}) {
	a.Display.Print(fmt.Sprintf("%v", msg))
}

func (a *Agent) jsCall(routeName string, params map[string]interface{}) (interface{}, error) {
	ep := a.Registry.Get(routeName)
	if ep == nil {
		a.throwStructuredError(fmt.Sprintf("unknown route: %s", routeName))
		return nil, nil // unreachable
	}

	// SECURITY: Reject admin routes if not in adminSection
	if strings.HasPrefix(routeName, "admin_") && !a.isInAdminSection {
		a.throwStructuredError(fmt.Sprintf("security error: route '%s' is administrative and can only be called inside upsilon.adminSection()", routeName))
		return nil, nil // unreachable
	}

	// Convert JS params to string map expected by endpoint.Execute
	inputs := make(map[string]string)
	for k, v := range params {
		if str, ok := v.(string); ok {
			inputs[k] = str
		} else {
			// Serialize everything else to JSON to preserve structure for the endpoint to decode
			b, _ := json.Marshal(v)
			inputs[k] = string(b)
		}
	}

	resp, err := ep.ExecuteRaw(a.Client, a.Session, inputs)
	if err != nil {
		a.throwStructuredError(fmt.Sprintf("transport error: %v", err))
		return nil, nil // unreachable
	}

	if !resp.Success {
		a.jsLog(fmt.Sprintf("[CALL_ERROR] Route %s failed: %s", routeName, resp.Message))
		// Throw a structured error matching [[api_standard_envelope]]. The engine's
		// rule-rejection error key (e.g. "entity.path.obstacle") is carried in
		// meta.error_key and lifted to a top-level `error_key` for easy access in
		// catch blocks. Keeping `meta` on the thrown value preserves forward
		// compatibility for additional debug fields.
		envErr := map[string]interface{}{
			"success":    false,
			"message":    resp.Message,
			"request_id": resp.RequestID,
			"status":     resp.StatusCode,
			"data":       nil,
			"meta":       resp.Meta,
		}

		if resp.Meta != nil {
			if v, ok := resp.Meta["error_key"]; ok {
				envErr["error_key"] = v
			}
		}
		panic(a.VM.ToValue(envErr))
	}

	// PROACTIVE TURN MEMORY: If an attack was successful, mark it immediately
	if routeName == "game_action" {
		if resp.Success {
			at := params["type"]
			if at == "attack" || at == "skill" {
				a.hasAttackedThisTurn = true
			}
		}
	}

	// Capture session state (tokens, IDs) from response
	endpoint.SyncSession(resp, a.Session)

	// Ensure WebSockets are synced if auth happened (token might have been set)
	a.Listener.Sync()

	return resp.Data, nil
}

func (a *Agent) throwStructuredError(msg string) {
	a.jsLog(fmt.Sprintf("[INTERNAL_ERROR] %s", msg))
	panic(a.VM.ToValue(map[string]interface{}{
		"success":    false,
		"message":    msg,
		"request_id": "cli-internal",
		"data":       nil,
	}))
}

func (a *Agent) jsGetContext(key string) string {
	val, _ := a.Session.Get(key)
	return val
}

func (a *Agent) jsSetContext(key, value string) {
	a.Session.Set(key, value)
}

func (a *Agent) jsGetEnv(key string) string {
	return os.Getenv(key)
}

func (a *Agent) jsGetAgentIndex() int {
	return a.AgentIndex
}

func (a *Agent) jsGetAgentCount() int {
	return a.AgentCount
}

func (a *Agent) jsSetShared(key string, value interface{}) {
	a.Shared.Set(key, value)
}

func (a *Agent) jsGetShared(key string) interface{} {
	val, ok := a.Shared.Get(key)
	if !ok {
		return nil
	}
	return val
}

// jsSleep pauses the current agent's goroutine without affecting others.
func (a *Agent) jsSleep(ms int) {
	start := time.Now()
	for time.Since(start) < time.Duration(ms)*time.Millisecond {
		a.jsProcessEvents()
		select {
		case <-a.Ctx.Done():
			return
		case <-time.After(10 * time.Millisecond):
		}
	}
}
