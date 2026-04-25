package script

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"time"
	"github.com/dop251/goja"
	"github.com/ecumeurs/upsiloncli/internal/dto"
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

		// High-level Lifecycle Helpers
		"bootstrapBot":      a.jsBootstrapBot,
		"joinWaitMatch":     a.jsJoinWaitMatch,
		"humanDelay":        a.jsHumanDelay,
		"registrationDelay": a.jsRegistrationDelay,
		"waitNextTurn":      a.jsWaitNextTurn,
		"syncGroup":         a.jsSyncGroup,
		"joinQueue":         a.jsJoinQueue,
		"waitForMatch":      a.jsWaitForMatch,

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
			"message":    fmt.Sprintf("API Error [%s]: %s", routeName, resp.Message),
			"request_id": resp.RequestID,
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
		actionType, _ := params["type"].(string)
		actorID, _ := params["entity_id"].(string)
		if actionType == "attack" && actorID == a.currentTurnEntityID {
			a.hasAttackedThisTurn = true
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

// jsOnTeardown stores a JS callback to be executed later
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

func (a *Agent) flattenEntities(board *dto.BoardState) []dto.Entity {
	var all []dto.Entity
	if board == nil { return all }
	for _, p := range board.Players {
		all = append(all, p.Entities...)
	}
	return all
}

func (a *Agent) jsFindPath(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 3 {
		return a.VM.ToValue(nil)
	}

	var start, end dto.Position
	var board dto.BoardState

	// Marshal/Unmarshal is the most reliable way to convert deep JS objects to Go DTOs
	startBytes, _ := json.Marshal(call.Arguments[0].Export())
	json.Unmarshal(startBytes, &start)

	endBytes, _ := json.Marshal(call.Arguments[1].Export())
	json.Unmarshal(endBytes, &end)

	boardBytes, _ := json.Marshal(call.Arguments[2].Export())
	json.Unmarshal(boardBytes, &board)
	
	// Inject flattened entities for pathfinding algorithms that expect them
	board.Entities = a.flattenEntities(&board)

	path := FindPath(&board, start, end)
	
	// Ensure proper JSON mapping for the return value
	var result interface{}
	pathBytes, _ := json.Marshal(path)
	json.Unmarshal(pathBytes, &result)

	return a.VM.ToValue(result)
}

// @spec-link [[api_plan_travel_toward]]
func (a *Agent) jsPlanTravelToward(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 3 {
		return a.VM.ToValue(nil)
	}

	entityID := call.Arguments[0].String()

	var target dto.Position
	targetBytes, _ := json.Marshal(call.Arguments[1].Export())
	json.Unmarshal(targetBytes, &target)

	var board dto.BoardState
	boardBytes, _ := json.Marshal(call.Arguments[2].Export())
	json.Unmarshal(boardBytes, &board)

	// Inject flattened entities
	board.Entities = a.flattenEntities(&board)

	// Enforcement: if the unit has already attacked this turn, movement is blocked
	if a.hasAttackedThisTurn && entityID == a.currentTurnEntityID {
		return a.VM.ToValue([]dto.Position{})
	}

	path := PlanTravelToward(&board, entityID, target)
	
	// Ensure proper JSON mapping for the return value
	var result interface{}
	pathBytes, _ := json.Marshal(path)
	json.Unmarshal(pathBytes, &result)

	return a.VM.ToValue(result)
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

// --- Tactical Utility Implementations ---

func (a *Agent) jsMyPlayer() interface{} {
	parts := a.Session.Participants()
	for _, p := range parts {
		if p.IsSelf {
			return p
		}
	}
	return nil
}

func (a *Agent) jsCurrentPlayer() interface{} {
	board := a.Session.LastBoard()
	if board == nil { return nil }
	
	if board.CurrentPlayerIsSelf {
		return a.jsMyPlayer()
	}

	// Find owner of the current entity
	for _, p := range board.Players {
		for _, e := range p.Entities {
			if e.ID == board.CurrentEntityID {
				return p
			}
		}
	}

	return nil
}

func (a *Agent) jsCurrentCharacter() interface{} {
	board := a.Session.LastBoard()
	if board == nil || board.Players == nil { return nil }
	for _, p := range board.Players {
		for _, e := range p.Entities {
			if e.ID == board.CurrentEntityID {
				return a.decorateEntity(e, board)
			}
		}
	}
	return nil
}

func (a *Agent) decorateEntity(e dto.Entity, board *dto.BoardState) interface{} {
	// Convert to map to add dynamic fields
	data, _ := json.Marshal(e)
	var res map[string]interface{}
	json.Unmarshal(data, &res)

	// Inject internal turn memory
	if e.ID == a.currentTurnEntityID {
		res["has_attacked"] = a.hasAttackedThisTurn
	} else {
		res["has_attacked"] = false
	}

	return res
}

func (a *Agent) jsMyCharacters() []dto.Entity {
	board := a.Session.LastBoard()
	if board == nil { return nil }
	var mine []dto.Entity
	for _, p := range board.Players {
		if p.IsSelf {
			mine = append(mine, p.Entities...)
		}
	}
	return mine
}

func (a *Agent) jsMyAllies() []dto.Player {
	board := a.Session.LastBoard()
	if board == nil { return nil }

	var allies []dto.Player
	var myTeam int
	found := false
	for _, p := range board.Players {
		if p.IsSelf {
			myTeam = p.Team
			found = true
			break
		}
	}

	if !found { return nil }
	
	for _, p := range board.Players {
		if p.Team == myTeam && !p.IsSelf {
			allies = append(allies, p)
		}
	}
	return allies
}

func (a *Agent) jsMyAlliesCharacters() []dto.Entity {
	allies := a.jsMyAllies()
	var all []dto.Entity
	for _, p := range allies {
		all = append(all, p.Entities...)
	}
	return all
}

func (a *Agent) jsMyFoes() []dto.Player {
	board := a.Session.LastBoard()
	if board == nil { return nil }

	var foes []dto.Player
	var myTeam int
	found := false
	for _, p := range board.Players {
		if p.IsSelf {
			myTeam = p.Team
			found = true
			break
		}
	}

	if !found { return nil }
	
	for _, p := range board.Players {
		if p.Team != myTeam {
			foes = append(foes, p)
		}
	}
	return foes
}

func (a *Agent) jsMyFoesCharacters() []dto.Entity {
	foes := a.jsMyFoes()
	var all []dto.Entity
	for _, p := range foes {
		all = append(all, p.Entities...)
	}
	return all
}

func (a *Agent) jsCellContentAt(x, y int) interface{} {
	board := a.Session.LastBoard()
	if board == nil { return nil }
	
	if x < 0 || x >= len(board.Grid.Cells) || y < 0 || y >= len(board.Grid.Cells[0]) {
		return nil
	}
	
	cell := board.Grid.Cells[x][y]
	var foundEntity *dto.Entity
	if cell.EntityID != "" {
		for _, p := range board.Players {
			for _, e := range p.Entities {
				if e.ID == cell.EntityID {
					foundEntity = &e
					break
				}
			}
			if foundEntity != nil { break }
		}
	}
	
	return map[string]interface{}{
		"obstacle": cell.Obstacle,
		"entity":   foundEntity,
	}
}

// resolveGridFromArg accepts either a board (BoardState-like) or a grid directly
// and returns a normalized *dto.Grid. This lets JS callers write cellAt(board, x, y)
// or cellAt(board.grid, x, y) interchangeably.
func (a *Agent) resolveGridFromArg(v goja.Value) *dto.Grid {
	if v == nil || goja.IsUndefined(v) || goja.IsNull(v) {
		return nil
	}
	m, ok := v.Export().(map[string]interface{})
	if !ok {
		return nil
	}
	// Prefer inner "grid" if it looks like a board
	if inner, ok := m["grid"].(map[string]interface{}); ok {
		g := &dto.Grid{}
		b, _ := json.Marshal(inner)
		if err := json.Unmarshal(b, g); err == nil && len(g.Cells) > 0 {
			return g
		}
	}
	// Otherwise treat the argument itself as a Grid
	g := &dto.Grid{}
	b, _ := json.Marshal(m)
	if err := json.Unmarshal(b, g); err == nil && len(g.Cells) > 0 {
		return g
	}
	return nil
}

// jsCellAt is the ONLY sanctioned way for scenario scripts to read a cell.
// It hides the underlying storage layout so we can migrate to Y-major
// (see [[ISS-079]]) without touching every test. The returned object is
// { x, y, obstacle, height, entity_id } or null if out of bounds / no board.
// @spec-link [[ISS-079]]
func (a *Agent) jsCellAt(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 3 {
		return goja.Null()
	}
	g := a.resolveGridFromArg(call.Arguments[0])
	if g == nil {
		// Fall back to the session board so cellAt(null, x, y) still works.
		if b := a.Session.LastBoard(); b != nil {
			g = &b.Grid
		}
	}
	if g == nil {
		return goja.Null()
	}
	x := int(call.Arguments[1].ToInteger())
	y := int(call.Arguments[2].ToInteger())

	// Current contract: cells[x][y] (width-major). Keep the check strict so
	// callers get a hard null on bad bounds instead of a wrong cell.
	if x < 0 || x >= len(g.Cells) {
		return goja.Null()
	}
	col := g.Cells[x]
	if y < 0 || y >= len(col) {
		return goja.Null()
	}
	c := col[y]
	return a.VM.ToValue(map[string]interface{}{
		"x":         x,
		"y":         y,
		"obstacle":  c.Obstacle,
		"height":    c.Height,
		"entity_id": c.EntityID,
	})
}

// jsForEachCell iterates every cell in (x, y) order and invokes the callback
// with the cell object produced by jsCellAt. Returning a truthy value from the
// callback stops iteration early, mirroring Array.prototype.some semantics.
// @spec-link [[ISS-079]]
func (a *Agent) jsForEachCell(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 2 {
		return goja.Undefined()
	}
	g := a.resolveGridFromArg(call.Arguments[0])
	if g == nil {
		if b := a.Session.LastBoard(); b != nil {
			g = &b.Grid
		}
	}
	if g == nil {
		return goja.Undefined()
	}
	cb, ok := goja.AssertFunction(call.Arguments[1])
	if !ok {
		return goja.Undefined()
	}
	for x := 0; x < len(g.Cells); x++ {
		for y := 0; y < len(g.Cells[x]); y++ {
			c := g.Cells[x][y]
			cellVal := a.VM.ToValue(map[string]interface{}{
				"x":         x,
				"y":         y,
				"obstacle":  c.Obstacle,
				"height":    c.Height,
				"entity_id": c.EntityID,
			})
			res, err := cb(goja.Undefined(), cellVal)
			if err != nil {
				panic(a.VM.ToValue(fmt.Sprintf("forEachCell callback error: %v", err)))
			}
			if res != nil && !goja.IsUndefined(res) && !goja.IsNull(res) && res.ToBoolean() {
				return res
			}
		}
	}
	return goja.Undefined()
}

// jsAutoBattleTurn executes one canonical battle turn per the intended AI:
//   1. Identify the nearest living foe (or a caller-provided target).
//   2. If out of reach, plan a path and MOVE toward it.
//   3. If in reach and the unit has not attacked yet, ATTACK.
//   4. Otherwise PASS.
//
// It returns a small report: { action, target_id, path_len } so scenarios can
// assert on what happened without re-reading the board.
//
// Reach is computed as "0 steps to reach a cell adjacent to the foe", i.e.
// planTravelToward returning an empty path when the unit is already adjacent.
// This decouples the reach heuristic from hard-coded Manhattan distance and
// from skill ranges that may evolve.
//
// Usage:
//   upsilon.autoBattleTurn(matchId)
//   upsilon.autoBattleTurn(matchId, foeCharacter)   // target a specific foe
//
// @spec-link [[uc_combat_turn]]
func (a *Agent) jsAutoBattleTurn(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 1 {
		panic(a.VM.ToValue("autoBattleTurn requires at least (matchId)"))
	}
	matchID := call.Arguments[0].String()

	board := a.Session.LastBoard()
	if board == nil {
		panic(a.VM.ToValue("autoBattleTurn called without a board snapshot — did you forget waitNextTurn()?"))
	}

	// Locate the acting entity (my character for this turn).
	var me *dto.Entity
	for i := range board.Players {
		for j := range board.Players[i].Entities {
			if board.Players[i].Entities[j].ID == board.CurrentEntityID {
				me = &board.Players[i].Entities[j]
				break
			}
		}
		if me != nil {
			break
		}
	}
	if me == nil {
		panic(a.VM.ToValue("autoBattleTurn: could not find current entity on board"))
	}

	// Target selection: explicit foe first, else nearest living foe.
	var foe *dto.Entity
	if len(call.Arguments) >= 2 && !goja.IsUndefined(call.Arguments[1]) && !goja.IsNull(call.Arguments[1]) {
		var explicit dto.Entity
		b, _ := json.Marshal(call.Arguments[1].Export())
		if err := json.Unmarshal(b, &explicit); err == nil && explicit.ID != "" {
			foe = &explicit
		}
	}
	if foe == nil {
		myTeam := -1
		for _, p := range board.Players {
			if p.IsSelf {
				myTeam = p.Team
				break
			}
		}
		bestDist := 1 << 30
		for i := range board.Players {
			if board.Players[i].Team == myTeam {
				continue
			}
			for j := range board.Players[i].Entities {
				e := board.Players[i].Entities[j]
				if e.HP <= 0 {
					continue
				}
				d := abs(e.Position.X-me.Position.X) + abs(e.Position.Y-me.Position.Y)
				if d < bestDist {
					bestDist = d
					foe = &board.Players[i].Entities[j]
				}
			}
		}
	}

	report := map[string]interface{}{
		"action":    "pass",
		"target_id": "",
		"path_len":  0,
	}

	// No foe? Pass.
	if foe == nil {
		a.jsCall("game_action", map[string]interface{}{
			"id":        matchID,
			"type":      "pass",
			"entity_id": me.ID,
		})
		return a.VM.ToValue(report)
	}

	// Compute a path toward the foe. An empty path means we're already adjacent.
	boardCopy := *board
	boardCopy.Entities = a.flattenEntities(&boardCopy)
	path := PlanTravelToward(&boardCopy, me.ID, foe.Position)

	inReach := len(path) == 0 && (abs(me.Position.X-foe.Position.X)+abs(me.Position.Y-foe.Position.Y)) <= 1

	if inReach && !a.hasAttackedThisTurn {
		report["action"] = "attack"
		report["target_id"] = foe.ID
		a.jsCall("game_action", map[string]interface{}{
			"id":            matchID,
			"type":          "attack",
			"entity_id":     me.ID,
			"target_coords": []dto.Position{foe.Position},
		})
		return a.VM.ToValue(report)
	}

	if len(path) > 0 && !a.hasAttackedThisTurn {
		report["action"] = "move"
		report["target_id"] = foe.ID
		report["path_len"] = len(path)
		a.jsCall("game_action", map[string]interface{}{
			"id":            matchID,
			"type":          "move",
			"entity_id":     me.ID,
			"target_coords": path,
		})
		return a.VM.ToValue(report)
	}

	// No path, out of reach, or already attacked: pass.
	a.jsCall("game_action", map[string]interface{}{
		"id":        matchID,
		"type":      "pass",
		"entity_id": me.ID,
	})
	return a.VM.ToValue(report)
}

func abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}

// --- New High-level Lifecycle Helpers ---

func (a *Agent) jsRegistrationDelay() {
	ms := 500 + rand.Intn(2500)
	a.jsLog(fmt.Sprintf("Anti-spam registration delay: %vms", ms))
	a.jsSleep(ms)
}

func (a *Agent) jsHumanDelay() {
	ms := 100 + rand.Intn(500)
	a.jsLog(fmt.Sprintf("Simulating human delay: %vms", ms))
	a.jsSleep(ms)
}

func (a *Agent) jsBootstrapBot(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 2 {
		panic(a.VM.ToValue("bootstrapBot requires at least (accountName, password)"))
	}

	accountName := call.Arguments[0].String()
	password := call.Arguments[1].String()

	// 1. Setup automatic teardown BEFORE registration to ensure cleanup if registration fails halfway
	a.GoTeardownHook = func() {
		a.jsLog("Running Automated Teardown...")

		safeCall := func(name string, params map[string]interface{}) {
			defer func() {
				if r := recover(); r != nil {
					a.jsLog(fmt.Sprintf("Teardown step '%s' skipped: %v", name, r))
				}
			}()
			a.jsCall(name, params)
		}

		// 1. Leave queue
		safeCall("matchmaking_leave", nil)

		// 2. Forfeit match if ID exists
		matchID := a.jsGetContext("match_id")
		if matchID != "" {
			a.jsLog("Forfeiting match " + matchID)
			safeCall("game_forfeit", map[string]interface{}{"id": matchID})
			a.jsSetContext("match_id", "")
		}

		// 3. Delete account
		a.jsLog("Deleting temporary account: " + accountName)
		safeCall("auth_delete", nil)
	}

	// 2. Registration Delay
	a.jsRegistrationDelay()

	// 3. Register
	params := map[string]interface{}{
		"account_name":          accountName,
		"email":                 accountName + "@example.com",
		"nickname":              "Bot_" + accountName,
		"password":              password,
		"password_confirmation": password,
		"full_address":          "Bot Street, Virtual Arena",
		"birth_date":            "1990-01-01T00:00:00Z",
	}

	// Allow overriding defaults if a 3rd argument is provided
	if len(call.Arguments) > 2 {
		if extra, ok := call.Arguments[2].Export().(map[string]interface{}); ok {
			for k, v := range extra {
				params[k] = v
			}
		}
	}

	resp, err := a.jsCall("auth_register", params)
	if err != nil {
		a.throwStructuredError("Registration failed: " + err.Error())
	}

	a.jsLog("Bot bootstrapped successfully.")

	// 4. Automatic Character Renaming to identifiable thematic names
	// This ensures bots aren't all named "Character 1, 2, 3" which was a common complaint.
	// We fetch characters and process the response directly as SyncSession may not pick up root arrays.
	charsData, _ := a.jsCall("profile_characters", nil)
	
	botNames := []string{"Slayer", "Warden", "Herald", "Sentinel", "Avenger", "Reaper", "Paladin", "Ranger", "Artificer", "Saboteur"}
	rand.Shuffle(len(botNames), func(i, j int) { botNames[i], botNames[j] = botNames[j], botNames[i] })

	if chars, ok := charsData.([]interface{}); ok && len(chars) > 0 {
		for i, item := range chars {
			char, ok := item.(map[string]interface{})
			if !ok { continue }
			
			id, ok := char["id"].(string)
			if !ok { continue }

			if i >= len(botNames) {
				break
			}
			
			newName := botNames[i]
			// If accountName is short, we can use it as a suffix for better identification
			// while staying within the 20-character limit of [[rule_character_renaming]]
			if len(accountName) <= 10 {
				newName = fmt.Sprintf("%s %s", botNames[i], accountName)
			}

			if len(newName) > 20 {
				newName = newName[:20]
			}

			a.jsLog(fmt.Sprintf("Renaming character %s to %s...", id, newName))
			a.jsCall("character_rename", map[string]interface{}{
				"characterId": id,
				"name":        newName,
			})
		}
	}

	return a.VM.ToValue(resp)
}

func (a *Agent) jsJoinWaitMatch(gameMode string) interface{} {
	// 1. Ensure private user channel is subscribed before joining matchmaking
	// This prevents the match.found event from being sent to a channel we aren't subbed to yet.
	key := a.Session.WSChannelKey()
	if key != "" {
		channel := fmt.Sprintf("private-user.%s", key)
		a.jsLog(fmt.Sprintf("Ensuring subscription to %s...", channel))
		start := time.Now()
		for !a.Listener.IsSubscribed(channel) {
			if time.Since(start) > 30*time.Second {
				a.throwStructuredError("Timed out waiting for private channel subscription")
			}
			a.jsSleep(100)
		}
	}

	a.jsLog("Joining queue: " + gameMode)
	_, err := a.jsCall("matchmaking_join", map[string]interface{}{"game_mode": gameMode})
	if err != nil {
		a.throwStructuredError("Failed to join queue: " + err.Error())
	}

	a.jsLog("Waiting for match.found...")
	matchEnvelope, err := a.jsWaitForEvent("match.found", 60000)
	if err != nil {
		a.throwStructuredError("Matchmaking timed out or failed: " + err.Error())
	}

	// Safely extract match_id
	env, ok := matchEnvelope.(map[string]interface{})
	if !ok { a.throwStructuredError("Invalid match envelope structure") }
	
	data, ok := env["data"].(map[string]interface{})
	if !ok { a.throwStructuredError("Invalid match event data structure") }

	matchID, _ := data["match_id"].(string)
	if matchID != "" {
		a.jsSetContext("match_id", matchID)
		a.jsLog("Match Found! ID: " + matchID)
	}

	return data
}

func (a *Agent) jsWaitNextTurn() interface{} {
	// 1. Check if it is already our turn based on the current session state
	// This prevents deadlocks if the match just started and it is already our turn.
	if board := a.Listener.Session.LastBoard(); board != nil {
		if board.CurrentPlayerIsSelf && board.Version > a.lastConsumedVersion {
			// Sync turn memory if resuming
			if a.currentTurnEntityID != board.CurrentEntityID {
				a.currentTurnEntityID = board.CurrentEntityID
				a.hasAttackedThisTurn = false
			}
			if board.Action != nil && board.Action.Type == "attack" && board.Action.ActorID == a.currentTurnEntityID {
				a.hasAttackedThisTurn = true
			}

			a.jsLog(fmt.Sprintf("--- Resume Turn! Already acting with %s (v%d) ---", a.getTurnLogInfo(board), board.Version))
			a.lastConsumedVersion = board.Version
			return a.VM.ToValue(board)
		}
	}

	for {
		// Wait for either tactical progression or game termination
		eventData, eventName, err := a.Listener.WaitForAnyData(a.Ctx, []string{"board.updated", "game.ended"}, 60000)
		if err != nil {
			a.throwStructuredError("Turn wait timed out or failed: " + err.Error())
		}

		if eventName == "game.ended" {
			winnerMsg := ""
			if env, ok := eventData.(map[string]interface{}); ok {
				if data, ok := env["data"].(map[string]interface{}); ok {
					if winner, exists := data["winner_team_id"]; exists {
						winnerMsg = fmt.Sprintf(" Winner: Team %v", winner)
					}
				}
			}
			a.jsLog(fmt.Sprintf("Match termination event received.%s Exiting battle loop.", winnerMsg))
			a.jsSetContext("match_id", "") // Clear to prevent teardown forfeit
			return nil
		}

		env, ok := eventData.(map[string]interface{})
		if !ok { continue }
		boardMap, ok := env["data"].(map[string]interface{})
		if !ok { continue }

		// Manual check for finished flag inside board.updated
		if finished, _ := boardMap["game_finished"].(bool); finished {
			winnerMsg := ""
			if winner, exists := boardMap["winner_team_id"]; exists {
				winnerMsg = fmt.Sprintf(" Winner: Team %v", winner)
			}
			a.jsLog(fmt.Sprintf("Match finished flag detected in update.%s Exiting battle loop.", winnerMsg))
			a.jsSetContext("match_id", "") // Clear to prevent teardown forfeit
			return nil
		}

		// Double-check ownership via session data (hydrated by Listener)
		board := a.Listener.Session.LastBoard()
		if board != nil && board.CurrentPlayerIsSelf && board.Version > a.lastConsumedVersion {
			// INTERNAL TURN MEMORY MANAGEMENT
			if a.currentTurnEntityID != board.CurrentEntityID {
				a.jsLog(fmt.Sprintf("Initiative shift: %s -> %s. Clearing turn memory.", a.currentTurnEntityID, board.CurrentEntityID))
				a.currentTurnEntityID = board.CurrentEntityID
				a.hasAttackedThisTurn = false
			}

			// Watch for attack actions to set the flag
			if board.Action != nil && board.Action.Type == "attack" && board.Action.ActorID == a.currentTurnEntityID {
				a.hasAttackedThisTurn = true
			}

			a.jsLog(fmt.Sprintf("--- My Turn! Acting with %s (v%d) ---", a.getTurnLogInfo(board), board.Version))
			a.lastConsumedVersion = board.Version
			return a.VM.ToValue(boardMap)
		}
		
		a.jsLog("Received board update, but it's not my turn yet. Continuing wait...")
	}
}

func (a *Agent) getTurnLogInfo(board *dto.BoardState) string {
	if board == nil {
		return "unknown"
	}
	for _, p := range board.Players {
		for _, e := range p.Entities {
			if e.ID == board.CurrentEntityID {
				return fmt.Sprintf("%s (%s, team %d)", e.Name, p.Nickname, p.Team)
			}
		}
	}
	return fmt.Sprintf("entity: %s", board.CurrentEntityID)
}

func (a *Agent) jsSyncGroup(key string, count int) {
	readyKey := key + "_ready"
	proceedKey := key + "_proceed"
	matchIdKey := key + "_match_id"

	myMatchID := a.jsGetContext("match_id")

	// Phase 1: Mark this agent as ready
	current := a.Shared.AtomicIncrement(readyKey, 1)
	a.jsLog(fmt.Sprintf("Agent %v ready for sync '%s' (%v/%v)...", a.AgentIndex, key, current, count))

	// If we're the first, set the group's expected match ID
	if current == 1 {
		a.Shared.Set(matchIdKey, myMatchID)
	}

	// Phase 2: Wait for all agents to be ready
	start := time.Now()
	for {
		// Check for context cancellation (Ctrl+C)
		select {
		case <-a.Ctx.Done():
			panic(a.VM.ToValue("SyncGroup cancelled: context cancelled"))
		default:
		}

		// Check timeout
		if time.Since(start) > 60*time.Second {
			val, _ := a.Shared.Get(readyKey)
			actualCount := 0
			if val != nil {
				if c, ok := val.(int); ok {
					actualCount = c
				}
			}
			a.throwStructuredError(fmt.Sprintf("SyncGroup '%s' timed out after 60s (got %v/%v agents)", key, actualCount, count))
		}

		// Check if all agents are ready
		val, ok := a.Shared.Get(readyKey)
		if ok && val != nil {
			if c, ok := val.(int); ok && c >= count {
				// ALL READY. Verify match ID consistency before proceeding.
				expected, ok := a.Shared.Get(matchIdKey)
				if ok {
					expectedStr, _ := expected.(string)
					if myMatchID != expectedStr {
						a.throwStructuredError(fmt.Sprintf("SyncGroup '%s' failed: Match ID mismatch. Agent %v expected match '%s' but found '%s'.", key, a.AgentIndex, expectedStr, myMatchID))
					}
					a.jsLog(fmt.Sprintf("Match ID verified for sync '%s' (%v/%v). Waiting for proceed signal...", key, c, count))
				} else {
					a.jsLog(fmt.Sprintf("All agents ready for sync '%s' (%v/%v). Waiting for proceed signal...", key, c, count))
				}
				break
			}
		}

		// Short sleep to avoid busy-waiting (10ms for faster response to Ctrl+C)
		time.Sleep(10 * time.Millisecond)
	}

	// Phase 3: Mark this agent as proceeding (after everyone is ready)
	current = a.Shared.AtomicIncrement(proceedKey, 1)
	a.jsLog(fmt.Sprintf("Agent %v proceeding from sync '%s' (%v/%v)...", a.AgentIndex, key, current, count))

	// Phase 4: Wait for all agents to signal proceed
	for {
		// Check for context cancellation (Ctrl+C)
		select {
		case <-a.Ctx.Done():
			panic(a.VM.ToValue("SyncGroup cancelled: context cancelled"))
		default:
		}

		// Check if all agents have signaled proceed
		val, ok := a.Shared.Get(proceedKey)
		if ok && val != nil {
			if c, ok := val.(int); ok && c >= count {
				a.jsLog(fmt.Sprintf("Group '%s' fully synchronized. All %v agents proceeding.", key, c))
				return
			}
		}

		// Short sleep to avoid busy-waiting
		time.Sleep(10 * time.Millisecond)
	}
}

func (a *Agent) jsJoinQueue(gameMode string) {
	a.jsCall("matchmaking_join", map[string]interface{}{"game_mode": gameMode})
}

func (a *Agent) jsWaitForMatch() interface{} {
	return a.jsJoinWaitMatch("1v1_PVP")
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
