# UpsilonCLI — API Journey Explorer & Tester

**UpsilonCLI** is the terminal client for E2E testing and bot orchestration against the Upsilon platform: it exposes every REST endpoint served by the Upsilon Hub gateway (`/api/v1`) through an interactive REPL, follows the hub's real-time Server-Sent Events stream, renders the tactical battle board in ANSI, and can spin up parallel Goja-scripted JS bots for scenario and load testing — all from the terminal.

## Installation & Building

```bash
cd /workspace/upsiloncli
go build -o bin/upsiloncli ./cmd/upsiloncli
```

## Quick Start

### Interactive REPL
```bash
./bin/upsiloncli
```

`UPSILON_BASE_URL` is a mandatory environment variable — the CLI targets the hub's REST + SSE surface directly (there is no built-in default). Set it via `.env` or the shell, or override per run:
```bash
UPSILON_BASE_URL=http://localhost:8090 ./bin/upsiloncli
./bin/upsiloncli --base-url http://custom-host:8090

# Force the local devcontainer default (hub direct on 127.0.0.1:8090)
./bin/upsiloncli --local
```

## Commands

| Command | Description |
|---|---|
| `routes` | List all available API endpoints with their `route_name` identifiers. |
| `call <route_name>` | Execute an endpoint interactively. Prompts for each input parameter with smart defaults from session context. |
| `jwt` | Display the current JWT token. |
| `jwt <token>` | Manually override the active JWT (for testing invalid/expired tokens). |
| `session` | Display current session context (user_id, match_id, characters, etc.). |
| `status` | Check end-to-end connectivity status (API & SSE stream). |
| `redraw` | Re-render the last known tactical board state. |
| `help` | Show available commands. |
| `exit` | Quit the CLI. |

## Feature Highlight: Autocompletion & Shortcuts

The CLI provides a rich interactive experience powered by `readline`:

- **TAB Completion**: Press `TAB` to autocomplete commands (`call`, `jwt`, `routes`, etc.) and API `route_name` identifiers.
- **Shorthand Execution**: You don't need to type `call auth_login`. Typing a valid route name directly at the root prompt (e.g., `auth_login`) executes it immediately.
- **Dynamic Prompt**: The prompt reflects your current state in real-time: `[auth:✓ user:alpha match:abc...] >`
- **Smart Parameter Defaults**: When an endpoint requires a parameter like `match_id` or `character_id`, the CLI auto-suggests values captured from previous API responses or SSE events.

## Real-time Event Stream (SSE)

UpsilonCLI maintains a background Server-Sent Events connection to the hub (`GET /api/v1/events`) during the REPL session.

- **Bearer-authenticated**: The stream connects automatically once you authenticate — the connection itself is your private channel; there are no channel subscriptions.
- **Auto-reconnect**: A dropped stream reconnects with backoff, replaying the latest board snapshot via `Last-Event-ID`.
- **Live Match Detection**: When a `match.found` event arrives, the CLI automatically:
    1. Sets the `match_id` in your session.
    2. Initializes match participants and the tactical grid.
- **Tactical Feed**: Receives `board.updated` events and caches the state for instant rendering.

## Tactical Board Visualization

Use the `redraw` command to visualize the current battle arena in full-color ANSI:

- **High-Fidelity Grid**: Renders obstacles (`#`), walkable tiles (`.`), and units.
- **Unit Symbols**:
    - `A`, `B`, `C`: Your own units.
    - `a`, `b`, `c`: Allied units (2v2 mode).
    - `X`, `Y`, `Z`: Enemy units.
- **Status Overlay**: Displays a detailed table with HP, Movement points, and Turn Delay for every unit on the field.
- **Current Turn Pointer**: Highlights the unit currently acting with a `>` marker.


### Agent-Friendly Automation & Scripting

For AI agents (like Antigravity) and CI/CD pipelines, UpsilonCLI provides a non-interactive "Direct-Call" mode. This allows executing commands and sharing state across multiple terminal sessions.

#### 1. Direct Execution
Skip the REPL by passing the command and arguments directly.
```bash
./bin/upsiloncli auth_login account_name=alpha password=...
```

#### 2. Argument Injection
Parameters can be provided in `key=value` format. If all required parameters for a route are provided via CLI arguments, the interaction is fully non-interactive.

#### 3. Session Persistence (`--persist` / `-P`)
By default, the session (JWT and context) is purely in-memory. Use the `--persist` flag to sync state to a local `.upsilon_session.json` file.
```bash
# Login and save the token
./bin/upsiloncli --persist auth_login account_name=... password=...

# Use the saved token in a subsequent call
./bin/upsiloncli --persist profile_get
```

> [!WARNING]
> The `.upsilon_session.json` file contains your active JWT. It is listed in `.gitignore` to prevent accidental commits, but treat it as sensitive data in your local environment.


Note: when creating new users, make sure to take into account [[rule_password_policy]]

### Multi-Agent Scripting Farm 🤖🤖🤖

UpsilonCLI can transform into a high-performance bot farm using the integrated **Goja JavaScript engine**. This allows you to run multiple automated agents in parallel for matchmaking load testing, balance verification, or end-to-end journey validation.

#### 1. Execution Flags

| Flag | Description |
|---|---|
| `--farm <script...>` | Execute one or more JavaScript files in parallel. Each script gets its own isolated network and session context ("Agent"). |
| `--logs <dir>` / `-L` | Redirect all output (including internal CURL and SSE event logs) to individual files in the specified directory. |

Example:
```bash
./bin/upsiloncli --logs ./bot_logs --farm samples/onboard_and_match.js samples/onboard_and_match.js
```

#### 2. JavaScript API (`upsilon` object)

Scripts have access to a global `upsilon` bridge to interact with the Go backend:

- **`upsilon.call(route_name, params)`**: Execute any API endpoint. Returns a parsed JSON object.
- **`upsilon.waitForEvent(event_name, timeout_ms)`**: Block execution until a specific realtime (SSE) event is received.
- **`upsilon.log(message)`**: Print a message to the agent's output stream, prefixed with the Agent ID.
- **`upsilon.getContext(key)` / `upsilon.setContext(key, value)`**: Read or write values from the agent's persistent session context.
- **`upsilon.onTeardown(callback)`**: Register a function to run when the script exits or crashes ([[mechanic_script_lifecycle]]).
- **`upsilon.assert(condition, message)`**: Halt script and trigger teardown on failure.
- **`upsilon.setShared(key, value)` / `upsilon.getShared(key)`**: Access thread-safe shared memory across agents ([[mechanic_shared_memory]]).
- **`upsilon.sleep(ms)`**: Precise flow control/delay.

#### 3. Sample Script: Onboarding & Matchmaking
See [samples/onboard_and_match.js](samples/onboard_and_match.js) for a complete example.

### Diagnostics & Automated Testing

UpsilonCLI includes built-in tools for analyzing battle logs and ensuring engine stability via zero-tolerance protocol testing.

#### 1. Bot-Identified Logging
When running in `--farm` mode, every log line (CURL, REPLY, WS) is automatically prefixed with the Agent ID (e.g., `[Bot-01]`). This allows for seamless debugging even when multiple bots are acting simultaneously.

#### 2. Log Parser & Diagnostic Tool
The [upsilon_log_parser.py](upsilon_log_parser.py) utility provides a structured summary of battle execution from a log file or a live stream:
- **Tactical Mode (`--tactical`)**: Performs deep analysis, tracking every entity eliminated, surviving unit HPs, and rendering the final board state.
- **Filter Mode (`--filter`)**: Targeted for live monitoring. It extracts tactical one-liners (Turn start, Actions, Thinking time, Clock timeouts, and Results) while stripping verbose network and board data.
- **Error Analysis**: Categorizes and counts `4xx/5xx` status codes to detect protocol violations.

Example:
```bash
# Live filter tactical events from a bot farm
./bin/upsiloncli --farm bot.js | python3 upsilon_log_parser.py --filter
```

#### 3. Stress Testing & Performance Orchestration
The [stress_test.py](../scripts/stress_test.py) script (located in the `scripts/` folder) is used for high-concurrency, long-duration evaluation of the entire Upsilon stack.

- **Concurreny**: Manages 12 simultaneous matches (1v1/2v2 PVP/PVE) by default.
- **Persistence**: Automatically respawns matches as they finish for the duration of the test (default 1 hour).
- **Monitoring**: Samples system metrics (CPU, Memory, File Descriptors) every 10 seconds.
- **Consolidation**: Aggregates logs from all matches into a unified `stress_test_report.md` (Markdown) and `stress_test_report.json` (Structured data).

Usage:
```bash
python3 scripts/stress_test.py
```

#### 4. Automated Battle Suite
Run the full battery of tactical engine tests (1v1, 2v2, PVE, PVP) using:
```bash
./tests/run_all_battles.sh
```
This script runs the bot farm, parses the resulting logs, and **fails** if any engine errors or protocol violations are detected.

### Architecture

```
cmd/upsiloncli/       Entry point (main.go)
internal/
  cli/                REPL loop, command dispatcher, autocompletion
  session/            JWT management, context store (match_id, user_id, etc.)
  api/                HTTP client, curl logger, response parser
  ws/                 Realtime listener, hub SSE stream (/api/v1/events)
  dto/                Shared Data Transfer Objects (Board, Entity, etc.)
  endpoint/           Endpoint registry and individual route implementations
  display/            Terminal output formatting, board renderer
```

## Transparency

Every API call made by the CLI displays:
1. The **full curl command** equivalent (copy-paste ready).
2. The **raw JSON response** (pretty-printed).
3. A **human-readable summary** of the result.

## JWT Lifecycle

- **Auto-capture**: Tokens from `login` / `register` responses are cached automatically.
- **Renewal**: If a response contains `meta.token`, the CLI transparently rotates its JWT per `[[mech_sanctum_token_renewal]]`.
- **Clearance**: Tokens are wiped on `logout` or `auth_delete` actions.
- **Override**: Use `jwt <token>` to inject an arbitrary token for testing.

## Session Context & Smart Defaults

The CLI tracks named values from API responses (e.g., `user_id`, `match_id`, `character_id`). When calling an endpoint that requires one of these parameters, the CLI pre-fills the default from context. The user can accept or override.

## Dependencies

- Go 1.25+
- Upsilon Hub gateway (REST `/api/v1` + SSE) reachable at `UPSILON_BASE_URL`
- upsilonapi (the "Bridge", embeds the upsilonbattle engine), reached indirectly through the hub, typically on `:8081`

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `UPSILON_BASE_URL` | Hub API base URL (REST + SSE) | (Required) |


## Related Documentation

- [Communication Reference](../communication.md)
- [Matchmaking Flow](../docs/us_api_flow_matchmaking.atom.md)
- [Game Turn Flow](../docs/us_api_flow_game_turn.atom.md)
