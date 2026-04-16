@spec-link [[script_farm]]

### **1. The `upsilon` API Reference**

Before writing a script, you need to know the tools available in your JavaScript environment.

#### Core Actions
* **`upsilon.call(route_name, {params})`**: Executes an API request. The `route_name` must match an endpoint in the registry (e.g., `auth_login`, `game_action`). Returns the parsed JSON `data` object.
* **`upsilon.waitForEvent(event_name, timeout_ms)`**: Pauses the script until the WebSocket receives the specified event (e.g., `match.found`, `board.updated`). Returns the event payload.
* **`upsilon.log(message)`**: Prints a message to the console, automatically prefixed with the agent's ID (e.g., `[Bot-1] Moving to 3,2`).
* **`upsilon.planTravelToward(entity_id, target_pos, board)`**: Calculates the optimal path for an entity toward a coordinate. It handles grid occupancy (units/obstacles) and movement credit limits. Returns an array of positions.

#### Session Context (Local to this specific Agent)
* **`upsilon.getContext(key)`**: Retrieves a value from the agent's local session (e.g., `user_id`, `match_id`).
* **`upsilon.setContext(key, value)`**: Overrides a context value.

* **`upsilon.onTeardown(function)`**: Registers a callback that is **guaranteed** to run when the script finishes, crashes, or fails an assertion (@spec-link [[mechanic_script_lifecycle]]).

#### Multi-Agent Sync (The Hive Mind @spec-link [[mechanic_shared_memory]])
* **`upsilon.setShared(key, value)`**: Writes data to a thread-safe global store visible to all concurrent agents.
* **`upsilon.getShared(key)`**: Reads data from the global store.
* **`upsilon.sleep(ms)`**: Pauses this specific agent without blocking others. (Interruptible via Ctrl+C).

#### Tactical Utilities ([[script_farm]])
* **`upsilon.myPlayer()`**: Returns the participant record for the current agent.
* **`upsilon.currentPlayer()`**: Returns the participant record for the player whose turn it is.
* **`upsilon.currentCharacter()`**: Returns the entity currently selected for the turn.
* **`upsilon.myCharacters()`**: Returns an array of entities owned by the agent.
* **`upsilon.myAllies()` / `upsilon.myAlliesCharacters()`**: Returns allies (excluding self) or their entities.
* **`upsilon.myFoes()` / `upsilon.myFoesCharacters()`**: Returns opponents or their entities.
* **`upsilon.cellContentAt(x, y)`**: Returns `{ obstacle: bool, entity: Entity|null }` for a specific grid coordinate.
12. 
13: #### **Lifecycle & CI Helpers (Streamlined)**
14: * **`upsilon.bootstrapBot(name, password, [overrides])`**: The recommended way to start a bot. It handles registration delay, account creation, and registers an automatic teardown that leaves the queue, forfeits matches, and deletes the account on exit.
15: * **`upsilon.joinWaitMatch(game_mode)`**: Joins matchmaking and blocks until a match is found. Returns match data.
16: * **`upsilon.waitNextTurn()`**: Blocks until it is the bot's turn or the game ends. Returns the `board` state or `null` if the game finished.
17: * **`upsilon.syncGroup(key, count)`**: Blocks until `count` agents have called this with the same `key`. Essential for multi-bot synchronization in CI.
18: * **`upsilon.humanDelay()`**: Random sleep (1-15s) to simulate human pacing.
19: * **`upsilon.registrationDelay()`**: Random sleep (0.5-3s) to prevent registration rate-limiting.

---

### **2. Building a Scenario: Step-by-Step**

Let’s build a robust test script. We will create an agent that creates an account, joins a PVE match, tries to make a move, and ensures the account is deleted afterward.

#### **The CI-Friendly Bot Pattern**
21. 
22: Using the high-level helpers, a complete bot script for a 1v1 PVP match becomes extremely concise:
23: 
24: ```javascript
25: // bot_battle.js
26: const botId = Math.floor(Math.random() * 10000);
27: 
28: // 1. Start the bot (Handles registration + automatic cleanup)
29: upsilon.bootstrapBot("bot_" + botId, "Pass123!Secure");
30: 
31: // 2. Sync with an opponent if running in a farm
32: upsilon.syncGroup("pvp_test", 2);
33: 
34: // 3. Join Matchmaking
35: upsilon.joinWaitMatch("1v1_PVP");
36: 
37: // 4. Main Battle Loop
38: while (true) {
39:     let board = upsilon.waitNextTurn();
40:     if (!board) break; // Game ended (logs victory/defeat automatically)
41: 
42:     // Execute tactical logic
43:     let target = upsilon.myFoesCharacters()[0];
44:     if (target) {
45:         upsilon.log("Attacking " + target.name);
46:         upsilon.call("game_action", {
47:             id: board.match_id, 
48:             type: "attack", 
49:             target_coords: target.position.x + "," + target.position.y
50:         });
51:     }
52:     
53:     // Always end turn with pass
54:     upsilon.call("game_action", { id: board.match_id, type: "pass" });
55: }
56: ```

---

---

### **3. Running Your Scripts**

Once your scripts are written, you execute them using the CLI coordinator. 

**Execution Options:**
*   `--timeout <seconds>`: Global execution timeout. Triggers `onTeardown()` if reached.
*   `--logs <dir>`: Save individual agent logs to a directory.
*   `--auto`: (Experimental) Full jouney autopilot.

**Single Test Run:**
```bash
./bin/upsiloncli --farm my_scenario.js --timeout 60
```

**Multi-Agent Farm (e.g., 2v2 PVP):**
```bash
./bin/upsiloncli --farm bot_alpha.js bot_beta.js ... --logs ./logs
```
