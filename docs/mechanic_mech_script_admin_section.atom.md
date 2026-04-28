---
id: mechanic_mech_script_admin_section
status: STABLE
layer: IMPLEMENTATION
priority: 2
parents:
  - [[script_farm]]
version: 1.0
dependents: []
human_name: "Administrative Protected Section"
type: MECHANIC
---

# New Atom

## INTENT
To provide a secure and automated way to perform administrative tasks within scripts without session leakage.

## THE RULE / LOGIC
1. Snapshot the current `Session`.
2. Login as `admin` using the resolved password.
3. Synchronize WebSockets to the new administrative token.
4. Execute the user-provided callback function.
5. In a `defer` block:
   a. Call `auth_logout` to terminate the admin session.
   b. Restore the `Session` from the snapshot.
   c. Synchronize WebSockets back to the original token.

## TECHNICAL INTERFACE
- **Code Tag:** `@spec-link [[mech_script_admin_section]]`
- **JS Function:** `upsilon.adminSection(() => { ... })`
- **Env Var:** `UPSILON_ADMIN_PASSWORD`

## EXPECTATION
- Admin operations succeed within the callback.
- Original session is perfectly restored after the callback.
- Admin user is logged out after the block.
- Credentials are fetched from environment or default.
