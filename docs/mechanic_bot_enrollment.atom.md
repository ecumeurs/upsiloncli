---
id: mechanic_bot_enrollment
status: DRAFT
type: MECHANIC
priority: 2
human_name: Bot Enrollment (register -> login -> enroll -> play)
version: 1.0
layer: IMPLEMENTATION
parents:
  - [[script_farm]]
dependents: []
---

# Bot Enrollment (register -> login -> enroll -> play)

## INTENT
Gate a bot's first game action behind an explicit battle enrollment call, since account registration alone no longer provisions a roster.

## THE RULE / LOGIC
1. Register (`auth_register`, served by auth post-Phase-4) yields account + token only — no roster, no player_stats row.
2. `bootstrapBot` calls `battle_enroll` immediately after registration succeeds, before touching characters, to create the roster + player_stats row and record the `tactical` service registration.
3. Any bridge helper or scenario that assumes a per-account roster exists must run after enroll — never immediately after `auth_register`/`auth_login`.
4. Enrollment is per game module. Today only `battle_enroll` exists (registers `tactical`); a future game module owns its own enroll endpoint and is not implied by this atom.

## TECHNICAL INTERFACE
- Code Tag: `@spec-link [[mechanic_bot_enrollment]]`
- CLI endpoint: `battle_enroll` maps to `POST /api/v1/battle/enroll` (RequireAuth; hub-owned).
- JS Bridge: `upsilon.bootstrapBot(accountName, password, [overrides])` sequences `auth_register` -> `battle_enroll` -> `profile_characters` (rename pass).
- Teardown: `GoTeardownHook` still calls `auth_delete` last; unaffected by enroll (auth owns account deletion).

## EXPECTATION
- After `bootstrapBot` returns, `profile_characters` returns the baseline roster (enroll has run).
- A registered-but-not-enrolled account gets a clear rejection from roster-dependent endpoints once the hub's registration gate lands (exercised as an edge scenario against the live stack).
- No scenario reaches `matchmaking_join`/`game_*`/`profile_characters` between `auth_register` and `battle_enroll`.
