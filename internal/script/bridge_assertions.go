package script

import (
	"fmt"
	"strings"

	"github.com/dop251/goja"
)

// jsOnTeardown stores a JS callback to be executed later
// @spec-link [[mechanic_script_lifecycle]]
func (a *Agent) jsOnTeardown(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) > 0 {
		if fn, ok := goja.AssertFunction(call.Arguments[0]); ok {
			a.TeardownHook = fn
		}
	}
	return goja.Undefined()
}

// jsAssert throws a JS exception if the condition is false
func (a *Agent) jsAssert(condition bool, msg string) {
	if !condition {
		panic(a.VM.ToValue(fmt.Sprintf("Assertion Failed: %s", msg)))
	}
}

// jsAssertResponse checks status and message, allowing "DEBUG MODE" prefixes locally
func (a *Agent) jsAssertResponse(resp map[string]interface{}, expectedStatus int, expectedMessage string) {
	status, ok := resp["status"].(int)

	if !ok {
		// Try to get from float64 if it came from JS directly
		if s, ok := resp["status"].(float64); ok {
			status = int(s)
		} else {
			panic(a.VM.ToValue("Assertion Failed: Response object missing numeric status field"))
		}
	}

	if status != expectedStatus {
		panic(a.VM.ToValue(fmt.Sprintf("Assertion Failed: Wrong status code (Expected: %d, Actual: %d)", expectedStatus, status)))
	}

	msg, _ := resp["message"].(string)

	// SUCCESS CONDITION:
	// 1. Strict match
	if msg == expectedMessage {
		return
	}

	// 2. Local Debug Mode loose match
	if a.IsLocal && strings.Contains(msg, "DEBUG MODE") {
		if strings.Contains(msg, expectedMessage) {
			return
		}
	}

	// FAILURE
	panic(a.VM.ToValue(fmt.Sprintf("Assertion Failed: Message mismatch (Expected: '%s', Actual: '%s')", expectedMessage, msg)))
}

// jsAssertEquals compares actual and expected and fails if not equal
func (a *Agent) jsAssertEquals(actual, expected interface{}, msg string) {
	// Using fmt.Sprintf to handle mixed types generically for the final check report
	actualStr := fmt.Sprintf("%v", actual)
	expectedStr := fmt.Sprintf("%v", expected)

	if actualStr != expectedStr {
		panic(a.VM.ToValue(fmt.Sprintf("Assertion Failed: %s (Expected: %s, Actual: %s)", msg, expectedStr, actualStr)))
	}
}

// jsAssertState validates that the current session state matches expectation
func (a *Agent) jsAssertState(expectedState string, msg string) {
	board := a.Session.LastBoard()
	if board == nil {
		panic(a.VM.ToValue(fmt.Sprintf("Assertion Failed: %s (Current state is NULL)", msg)))
	}

	// Example: compare some state flag or current player
	// This is a high-level helper that could be expanded based on needs
	// For now, let's keep it simple: check if game_finished status matches
	if expectedState == "FINISHED" {
		if !board.GameFinished {
			panic(a.VM.ToValue(fmt.Sprintf("Assertion Failed: %s (Expected state FINISHED but match still active)", msg)))
		}
	} else if expectedState == "ACTIVE" {
		if board.GameFinished {
			panic(a.VM.ToValue(fmt.Sprintf("Assertion Failed: %s (Expected state ACTIVE but match is finished)", msg)))
		}
	} else {
		// Generic string check against a combined state key if needed
		panic(a.VM.ToValue(fmt.Sprintf("Assertion Failed: %s (Unsupported state check: %s)", msg, expectedState)))
	}
}
