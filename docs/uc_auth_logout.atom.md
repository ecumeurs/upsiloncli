---
id: uc_auth_logout
human_name: "User Logout Use Case"
type: MODULE
layer: ARCHITECTURE
version: 1.0
status: STABLE
priority: 3
tags: [auth, logout, session]
parents:
  - [[req_security]]
  - [[us_auth_logout]]
dependents:
  - [[api_auth_logout]]
---

# User Logout Use Case

## INTENT
To coordinate the secure termination of an active session for both Players and Administrators, ensuring all state is cleared from the logic layer and server.

## THE RULE / LOGIC
1. **Trigger**: User initiates logout (e.g., clicking Header button).
2. **State Invalidation**:
    - Client-side: Clear internal session state (Vuex/Pinia).
    - Server-side: Delegate to [[api_auth_logout]] to revoke the Sanctum token.
3. **Redirection**: Following successful invalidation, the System MUST redirect the user to the Landing Page (Guest state).

## TECHNICAL INTERFACE (The Bridge)
- **Code Tag:** `@spec-link [[uc_auth_logout]]`
- **Related Issue:** `#auth-session`
- **UI Logic:** `AuthService.logout()`

## EXPECTATION (For Testing)
1. Requests following logout with the old token return `401 Unauthorized`.
2. Navigation to protected routes after logout redirects to Landing Page.
3. Client-side session storage (LocalStorage/SessionStorage) is purged.
