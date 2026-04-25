---
id: uc_player_login
human_name: "Player Login Use Case"
type: MODULE
layer: ARCHITECTURE
version: 1.0
status: STABLE
priority: 5
tags: [auth, login]
parents:
  - [[api_auth_login]]
  - [[req_player_experience]]
  - [[ui_dashboard]]
dependents: []
---

# Player Login Use Case

## INTENT
To authenticate existing players and transition them to the Character Review Dashboard.

## THE RULE / LOGIC
1. Guest provides credentials (Account Name/Password) via the login interface.
2. System validates credentials against stored player records.
3. Upon success, System issues a JWT Bearer token.
4. User is redirected to the Dashboard for character review.

## TECHNICAL INTERFACE (The Bridge)
- **Code Tag:** `@spec-link [[uc_player_login]]`
- **Related Issue:** `#auth-login`

## EXPECTATION (For Testing)
- Successful authentication results in a valid JWT.
- Successful authentication redirects to the Dashboard.
- Failed authentication returns a 401 Unauthorized error.
