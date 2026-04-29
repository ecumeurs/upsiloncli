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
4. Set the `isInAdminSection` context flag to `true`.
5. Create a scoped `admin` proxy object containing `call`, `log`, and `assert` methods.
6. Execute the user-provided callback function, passing the `admin` object as the first argument.
7. In a `defer` block:
   a. Set the `isInAdminSection` context flag to `false`.
   b. Call `auth_logout` to terminate the admin session.
   c. Restore the `Session` from the snapshot.
   d. Synchronize WebSockets back to the original token.

## TECHNICAL INTERFACE
- **Code Tag:** `@spec-link [[mech_script_admin_section]]`
- **JS Function:** `upsilon.adminSection((admin) => { ... })`
- **Scoped Object:** The callback receives an `admin` proxy object with `call`, `log`, and `assert` methods.
- **Security:** `admin_*` routes are rejected if called via the global `upsilon` object outside this section.

## EXPECTATION
- Admin operations succeed within the callback.
- Original session is perfectly restored after the callback.
- Admin user is logged out after the block.
- Credentials are fetched from environment or default.
