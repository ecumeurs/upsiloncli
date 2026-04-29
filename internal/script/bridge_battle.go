package script

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"time"

	"github.com/dop251/goja"
	"github.com/ecumeurs/upsiloncli/internal/dto"
)

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
		a.jsLog(fmt.Sprintf("Auto Action: Pass (no Foe)"))

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
		a.jsLog(fmt.Sprintf("Auto Action: Attack (%d,%d)", foe.Position.X, foe.Position.Y))
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

		pathStr := ""
		for i, p := range path {
			if i > 0 {
				pathStr += " -> "
			}
			pathStr += fmt.Sprintf("(%d,%d)", p.X, p.Y)
		}
		a.jsLog(fmt.Sprintf("Auto Action: Move %s", pathStr))

		a.jsCall("game_action", map[string]interface{}{
			"id":            matchID,
			"type":          "move",
			"entity_id":     me.ID,
			"target_coords": path,
		})
		return a.VM.ToValue(report)
	}

	a.jsLog(fmt.Sprintf("Auto Action: Pass"))
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
			if !ok {
				continue
			}

			id, ok := char["id"].(string)
			if !ok {
				continue
			}

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
	if !ok {
		a.throwStructuredError("Invalid match envelope structure")
	}

	data, ok := env["data"].(map[string]interface{})
	if !ok {
		a.throwStructuredError("Invalid match event data structure")
	}

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
			if board.Action != nil && (board.Action.Type == "attack" || board.Action.Type == "skill") && board.Action.ActorID == a.currentTurnEntityID {
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
		if !ok {
			continue
		}
		boardMap, ok := env["data"].(map[string]interface{})
		if !ok {
			continue
		}

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
			if board.Action != nil && (board.Action.Type == "attack" || board.Action.Type == "skill") && board.Action.ActorID == a.currentTurnEntityID {
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

// jsAdminSection executes a callback as the administrative user.
// It snapshots the current session, performs admin login, runs the callback,
// and automatically restores the original session via a defer block.
func (a *Agent) jsAdminSection(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 1 {
		panic(a.VM.ToValue("adminSection requires a callback function"))
	}
	cb, ok := goja.AssertFunction(call.Arguments[0])
	if !ok {
		panic(a.VM.ToValue("adminSection: argument 1 must be a function"))
	}

	// 1. Capture current session state to restore later
	originalSession := a.Session.Snapshot()

	// 2. Perform Admin Login
	adminPassword := os.Getenv("UPSILON_ADMIN_PASSWORD")
	if adminPassword == "" {
		adminPassword = "AdminPassword123!" // Default testing password
	}

	a.jsLog("--- [ADMIN_SECTION] Entering protected block ---")
	a.isInAdminSection = true
	_, err := a.jsCall("admin_login", map[string]interface{}{
		"account_name": "admin",
		"password":     adminPassword,
	})
	if err != nil {
		a.isInAdminSection = false
		panic(a.VM.ToValue("adminSection: Admin login failed: " + err.Error()))
	}

	// 3. Execute the callback with automatic cleanup
	// We use a defer to ensure the session is restored even if the callback panics.
	defer func() {
		a.jsLog("--- [ADMIN_SECTION] Exiting block, restoring session ---")
		a.isInAdminSection = false
		// Logout admin to be clean
		func() {
			defer recover() // Ignore logout errors during teardown
			a.jsCall("auth_logout", nil)
		}()
		a.Session.Restore(originalSession)
		a.Listener.Sync()
	}()

	// Create a scoped admin object to pass to the callback
	adminObj := a.VM.NewObject()
	adminObj.Set("call", a.jsCall)
	adminObj.Set("log", a.jsLog)
	adminObj.Set("assert", a.jsAssert)

	res, err := cb(goja.Undefined(), adminObj)
	if err != nil {
		panic(a.VM.ToValue(fmt.Sprintf("adminSection callback error: %v", err)))
	}

	return res
}
