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

	if !resp.Success {
		panic(a.VM.ToValue(resp))
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
			a.jsCall("game_forfeit", map[string]interface{}{"id": matchID})
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
				panic(a.VM.ToValue("Timed out waiting for private channel subscription"))
			}
			a.jsSleep(100)
		}
	}

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
			panic(a.VM.ToValue("Turn wait timed out or failed: " + err.Error()))
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
			panic(a.VM.ToValue(fmt.Sprintf("SyncGroup '%s' timed out after 60s (got %v/%v agents)", key, actualCount, count)))
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
						panic(a.VM.ToValue(fmt.Sprintf("SyncGroup '%s' failed: Match ID mismatch. Agent %v expected match '%s' but found '%s'.", key, a.AgentIndex, expectedStr, myMatchID)))
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

func (a *Agent) jsJoinQueue(gameMode string) interface{} {
	a.jsLog("Requesting matchmaking join: " + gameMode)
	resp, err := a.jsCall("matchmaking_join", map[string]interface{}{"game_mode": gameMode})
	if err != nil {
		panic(a.VM.ToValue("Failed to join queue: " + err.Error()))
	}
	return resp
}

func (a *Agent) jsWaitForMatch() interface{} {
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

