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

func (a *Agent) jsAssert(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 1 {
		panic(a.VM.ToValue("assert requires a condition"))
	}
	condition := call.Arguments[0].ToBoolean()
	msg := ""
	if len(call.Arguments) > 1 {
		msg = call.Arguments[1].String()
	}

	if !condition {
		panic(a.VM.ToValue(fmt.Sprintf("Assertion Failed: %s", msg)))
	}
	return goja.Undefined()
}

// jsAssertResponse checks status and message, allowing "DEBUG MODE" prefixes locally
func (a *Agent) jsAssertResponse(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 2 {
		panic(a.VM.ToValue("assertResponse requires at least (response, expectedStatus)"))
	}

	respObj := call.Arguments[0].Export()
	resp, ok := respObj.(map[string]interface{})
	if !ok {
		panic(a.VM.ToValue(fmt.Sprintf("Assertion Failed: assertResponse expects an object, got %T: %v", respObj, respObj)))
	}

	expectedStatusVal := call.Arguments[1].Export()
	var expectedStatus int
	if s, ok := expectedStatusVal.(int64); ok {
		expectedStatus = int(s)
	} else if s, ok := expectedStatusVal.(int); ok {
		expectedStatus = s
	} else if s, ok := expectedStatusVal.(float64); ok {
		expectedStatus = int(s)
	}

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

	if len(call.Arguments) < 3 {
		return goja.Undefined()
	}

	expectedMessage := call.Arguments[2].String()
	msg, _ := resp["message"].(string)

	// SUCCESS CONDITION:
	// 1. Strict match
	if msg == expectedMessage {
		return goja.Undefined()
	}

	// 2. Local Debug Mode loose match
	if strings.Contains(msg, "DEBUG MODE") {
		if strings.Contains(msg, expectedMessage) {
			return goja.Undefined()
		}
	}

	// FAILURE
	panic(a.VM.ToValue(fmt.Sprintf("Assertion Failed: Message mismatch (Expected: '%s', Actual: '%s')", expectedMessage, msg)))
}

func (a *Agent) jsAssertEquals(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 2 {
		panic(a.VM.ToValue("assertEquals requires (actual, expected)"))
	}
	actual := call.Arguments[0].Export()
	expected := call.Arguments[1].Export()
	msg := ""
	if len(call.Arguments) > 2 {
		msg = call.Arguments[2].String()
	}

	actualStr := fmt.Sprintf("%v", actual)
	expectedStr := fmt.Sprintf("%v", expected)

	if actualStr != expectedStr {
		panic(a.VM.ToValue(fmt.Sprintf("Assertion Failed: %s (Expected: %s, Actual: %s)", msg, expectedStr, actualStr)))
	}
	return goja.Undefined()
}

func (a *Agent) jsAssertState(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 1 {
		panic(a.VM.ToValue("assertState requires (expectedState)"))
	}
	expectedState := call.Arguments[0].String()
	msg := ""
	if len(call.Arguments) > 1 {
		msg = call.Arguments[1].String()
	}

	board := a.Session.LastBoard()
	if board == nil {
		panic(a.VM.ToValue(fmt.Sprintf("Assertion Failed: %s (Current state is NULL)", msg)))
	}

	if expectedState == "FINISHED" {
		if !board.GameFinished {
			panic(a.VM.ToValue(fmt.Sprintf("Assertion Failed: %s (Expected state FINISHED but match still active)", msg)))
		}
	} else if expectedState == "ACTIVE" {
		if board.GameFinished {
			panic(a.VM.ToValue(fmt.Sprintf("Assertion Failed: %s (Expected state ACTIVE but match is finished)", msg)))
		}
	} else {
		panic(a.VM.ToValue(fmt.Sprintf("Assertion Failed: %s (Unsupported state check: %s)", msg, expectedState)))
	}
	return goja.Undefined()
}
