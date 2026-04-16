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

#### Environment
* **`upsilon.getEnv(key)`**: Retrieves an environment variable from the host system.
* **`upsilon.getAgentIndex()`**: Returns the 0-based index of the current agent in the farm (e.g., `0` for Bot-01, `1` for Bot-02).
* **`upsilon.getAgentCount()`**: Returns the total number of agents running in the current farm execution.

#### Multi-Agent Sync (The Hive Mind @spec-link [[mechanic_shared_memory]])
* **`upsilon.setShared(key, value)`**: Writes data to a thread-safe global store visible to all concurrent agents.
* **`upsilon.getShared(key)`**: Reads data from the global store.
* **`upsilon.sleep(ms)`**: Pauses this specific agent without blocking others. (Interruptible via Ctrl+C).

#### Tactical Utilities ([[script_farm]])
* **`upsilon.myPlayer()`**: Returns the participant record for the current agent.
* **`upsilon.currentPlayer()`**: Returns the participant record for the player whose turn it is.
* **`upsilon.currentCharacter()`**: Returns the entity currently selected for the turn (See [Tactical Entities](#tactical-entities)).
* **`upsilon.myCharacters()`**: Returns an array of entities owned by the agent.
* **`upsilon.myAllies()` / `upsilon.myAlliesCharacters()`**: Returns allies (excluding self) or their entities.
* **`upsilon.myFoes()` / `upsilon.myFoesCharacters()`**: Returns opponents or their entities.
* **`upsilon.cellContentAt(x, y)`**: Returns `{ obstacle: boolean, entity: Entity|null }`. Note: The grid is **X-major** (Column-Major).

---

### **2. Tactical Entities and State**

Characters exposed via `upsilon.currentCharacter()` or `upsilon.myCharacters()` represent a single tactical unit with the following properties:

- **`id`**: Unique identifier (UUID).
- **`name`**: Unit display name.
- **`hp` / `max_hp`**: Unit health.
- **`move` / `max_move`**: Remaining and total movement points.
- **`position`**: Current `{x, y}` coordinates.
- **`has_attacked`**: (NEW) Boolean indicating if the unit has already performed an attack in the current turn.
- **`dead`**: True if eliminated.

#### Tactical Constraints
- **Attack ends Movement**: Once a unit attacks (`has_attacked` is true), the `upsilon.planTravelToward()` helper will automatically return an empty array, and further "move" actions will be rejected by the engine.
- **Turn Reset**: Tactical flags (`has_attacked` and `move` credits) are automatically reset by the bridge when the initiative shifts to a new entity.

---

### **3. Lifecycle & CI Helpers (Streamlined)**

* **`upsilon.bootstrapBot(name, password, [overrides])`**: The recommended way to start a bot. It handles registration delay, account creation, and registers an automatic teardown that leaves the queue, forfeits matches, and deletes the account on exit.
* **`upsilon.joinWaitMatch(game_mode)`**: Joins matchmaking and blocks until a match is found. Returns match data.
* **`upsilon.waitNextTurn()`**: Blocks until it is the bot's turn or the game ends. Returns the `board` state or `null` if the game finished.
* **`upsilon.syncGroup(key, count)`**: Blocks until `count` agents have called this with the same `key`.
* **`upsilon.humanDelay()`**: Random sleep (1-15s) to simulate human pacing.
* **`upsilon.registrationDelay()`**: Random sleep (0.5-3s) to prevent registration rate-limiting.

---

### **4. Coordination Patterns**

When multiple agents run in the same farm, use `syncGroup` and `sharedMemory` to coordinate.

#### **Sharing a Match ID (Barrier Pattern)**
```javascript
const agentCount = upsilon.getAgentCount();
const agentIndex = upsilon.getAgentIndex();
const matchData = upsilon.joinWaitMatch("1v1_PVP");

if (agentIndex === 0) {
    upsilon.setShared("global_match_id", matchData.match_id);
}

// ALL agents must call the barrier
upsilon.syncGroup("match_ready", agentCount);

// Now everyone can safely read the shared value
const sharedId = upsilon.getShared("global_match_id");
upsilon.assert(sharedId === matchData.match_id, "Joined different matches!");
```

---

### **5. Running Your Scripts**

Once your scripts are written, you execute them using the CLI coordinator. 

**Single Test Run:**
```bash
./bin/upsiloncli --farm my_scenario.js --timeout 60
```

**Multi-Agent Farm (e.g., 1v1 PVP):**
```bash
./bin/upsiloncli --farm bot_alpha.js bot_beta.js --logs ./logs
```
