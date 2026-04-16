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
		"getEnv": a.jsGetEnv,
		
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

		// High-level Lifecycle Helpers
		"bootstrapBot":      a.jsBootstrapBot,
		"joinWaitMatch":     a.jsJoinWaitMatch,
		"humanDelay":        a.jsHumanDelay,
		"registrationDelay": a.jsRegistrationDelay,
		"waitNextTurn":      a.jsWaitNextTurn,
		"syncGroup":         a.jsSyncGroup,
	}
	a.VM.Set("upsilon", upsilonObj)
}

func (a *Agent) jsLog(msg interface{}) {
	a.Display.Print(fmt.Sprintf("%v", msg))
}

func (a *Agent) jsCall(routeName string, params map[string]interface{}) (interface{}, error) {
	ep := a.Registry.Get(routeName)
	if ep == nil {
		return nil, fmt.Errorf("unknown route: %s", routeName)
	}

	// Convert JS params to string map expected by endpoint.Execute
	inputs := make(map[string]string)
	for k, v := range params {
		inputs[k] = fmt.Sprintf("%v", v)
	}

	resp, err := ep.ExecuteRaw(a.Client, a.Session, inputs)
	if err != nil {
		return nil, err
	}

	// Capture session state (tokens, IDs) from response
	endpoint.SyncSession(resp, a.Session)

	// Ensure WebSockets are synced if auth happened (token might have been set)
	a.Listener.Sync()

	return resp.Data, nil
}

func (a *Agent) jsGetContext(key string) string {
	val, _ := a.Session.Get(key)
	return val
}

func (a *Agent) jsSetContext(key, value string) {
	a.Session.Set(key, value)
}

func (a *Agent) jsWaitForEvent(eventName string, timeoutMs int) (interface{}, error) {
	return a.Listener.WaitForData(a.Ctx, eventName, timeoutMs)
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
		// Panic inside a Goja bridged function causes a catchable JS exception
		panic(a.VM.ToValue(fmt.Sprintf("Assertion Failed: %s", msg)))
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
	select {
	case <-a.Ctx.Done():
		return
	case <-time.After(time.Duration(ms) * time.Millisecond):
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
				return e
			}
		}
	}
	return nil
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
	
	if y < 0 || y >= len(board.Grid.Cells) || x < 0 || x >= len(board.Grid.Cells[0]) {
		return nil
	}
	
	cell := board.Grid.Cells[y][x]
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

// --- New High-level Lifecycle Helpers ---

func (a *Agent) jsRegistrationDelay() {
	ms := 500 + rand.Intn(2500)
	a.jsLog(fmt.Sprintf("Anti-spam registration delay: %vms", ms))
	a.jsSleep(ms)
}

func (a *Agent) jsHumanDelay() {
	ms := 1000 + rand.Intn(14000)
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

		// Leave queue
		a.jsCall("matchmaking_leave", nil)

		// Forfeit match if ID exists
		matchID := a.jsGetContext("match_id")
		if matchID != "" {
			a.jsLog("Forfeiting match " + matchID)
			a.jsCall("game_action", map[string]interface{}{"id": matchID, "type": "forfeit"})
		}

		// Delete account
		a.jsLog("Deleting temporary account: " + accountName)
		a.jsCall("auth_delete", nil)
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
		panic(a.VM.ToValue("Registration failed: " + err.Error()))
	}

	a.jsLog("Bot bootstrapped successfully.")
	return a.VM.ToValue(resp)
}

func (a *Agent) jsJoinWaitMatch(gameMode string) interface{} {
	a.jsLog("Joining queue: " + gameMode)
	_, err := a.jsCall("matchmaking_join", map[string]interface{}{"game_mode": gameMode})
	if err != nil {
		panic(a.VM.ToValue("Failed to join queue: " + err.Error()))
	}

	a.jsLog("Waiting for match.found...")
	matchEnvelope, err := a.jsWaitForEvent("match.found", 60000)
	if err != nil {
		panic(a.VM.ToValue("Matchmaking timed out or failed: " + err.Error()))
	}

	// Safely extract match_id
	env, ok := matchEnvelope.(map[string]interface{})
	if !ok { panic(a.VM.ToValue("Invalid match envelope structure")) }
	
	data, ok := env["data"].(map[string]interface{})
	if !ok { panic(a.VM.ToValue("Invalid match event data structure")) }

	matchID, _ := data["match_id"].(string)
	if matchID != "" {
		a.jsSetContext("match_id", matchID)
		a.jsLog("Match Found! ID: " + matchID)
	}

	return data
}

func (a *Agent) jsWaitNextTurn() interface{} {
	for {
		eventData, err := a.jsWaitForEvent("board.updated", 60000)
		if err != nil {
			panic(a.VM.ToValue("Turn wait timed out or failed: " + err.Error()))
		}

		env, ok := eventData.(map[string]interface{})
		if !ok { continue }
		board, ok := env["data"].(map[string]interface{})
		if !ok { continue }

		if finished, _ := board["game_finished"].(bool); finished {
			winner, _ := board["winner_is_self"].(bool)
			if winner {
				a.jsLog("VICTORY IS MINE!")
			} else {
				a.jsLog("Defeated... perishing with honor.")
			}
			a.jsSetContext("match_id", "") // Clear to prevent teardown forfeit
			return nil
		}

		if active, _ := board["current_player_is_self"].(bool); active {
			a.jsLog(fmt.Sprintf("--- My Turn! Acting with entity: %v ---", board["current_entity_id"]))
			return board
		}
	}
}

func (a *Agent) jsSyncGroup(key string, count int) {
	readyKey := key + "_ready"
	
	// Increment our presence
	val, _ := a.Shared.Get(readyKey)
	current := 0
	if val != nil {
		if c, ok := val.(int); ok { current = c }
	}
	a.Shared.Set(readyKey, current+1)

	a.jsLog(fmt.Sprintf("Waiting for syncing group '%s' (%v/%v)...", key, current+1, count))

	// Poll until everyone is ready
	for {
		val, _ := a.Shared.Get(readyKey)
		if val != nil {
			if c, ok := val.(int); ok && c >= count {
				break
			}
		}
		a.jsSleep(500)
	}
	a.jsLog(fmt.Sprintf("Group '%s' synchronized. Proceeding.", key))
}

