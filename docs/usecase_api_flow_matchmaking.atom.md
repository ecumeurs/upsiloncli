---
id: usecase_api_flow_matchmaking
status: STABLE
human_name: Matchmaking API Flow Example
type: USECASE
priority: 3
dependents: []
layer: CUSTOMER
version: 1.0
tags: flow,matchmaking,example,api
parents:
  - [[requirement_customer_api_first]]
  - [[uc_matchmaking]]
---

# New Atom

## INTENT
To provide a step-by-step logical example of how a client joins a match using only API interactions.

## THE RULE / LOGIC
### Step 1: Authentication
- **Action**: `POST /api/v1/auth/login`
- **Output**: Retrieve `token` and `user.id`. All subsequent requests require `Authorization: Bearer <token>`.

### Step 2: Queue Availability check
- **Action**: `GET /api/v1/matchmaking/status`
- **Intent**: Verify user is not already in a queue or match (status: 'idle').

### Step 3: Join the Queue
- **Action**: `POST /api/v1/matchmaking/join`
- **Input**: `{ "game_mode": "1v1_PVE" }`
- **Intent**: Commit the survivor to the matchmaking pool.

### Step 4: Event Observation (Real-time)
- **Action**: Connect to WebSocket via Laravel Reverb.
- **Join Waiting State**: Listen to Channel `private-user.{user_id}`.
- **Payload**: Wait for `MatchFound` event containing `match_id`.
- **Alternative (Fallback Polling)**: `GET /api/v1/matchmaking/status` until `status` becomes `matched`.

### Step 5: Match Handshake
- **Action**: `GET /api/v1/game/{match_id}`
- **Intent**: Fetch the authoritative initial state to begin the tactical simulation.
- **Observe**: Listen to Channel `private-arena.{match_id}` for board updates.

## TECHNICAL INTERFACE
- **Related Specs:** `[[api_matchmaking]]`, `[[api_auth_login]]`
- **Code Tag:** `@spec-link [[usecase_api_flow_matchmaking]]`

## EXPECTATION
- Sequence completes within timeout.
- Client successfully transitions from 'IDLE' to 'IN_MATCH' via API.
- Reverb (WebSocket) message is received during the polling/waiting phase.
