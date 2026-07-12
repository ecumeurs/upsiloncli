// upsiloncli/tests/scenarios/edge_auth_non_admin_access.js
// @test-link [[uc_admin_login]]
//
// STRUCTURAL LIMITATION (flagged for ISS-107 orchestrator — see #17 in
// ci_edge_case_reporting.md). uc_admin_login step 2 requires the server to
// reject a non-admin account at POST /api/v1/auth/admin/login
// (upsilonhub/internal/gateway/auth.go:100-103, `!user.IsAdmin()` -> 403
// "Access denied. Administrative privileges required."). Confirmed live via
// raw curl: the server genuinely enforces this (real 403, exact message).
// BUT this scenario cannot reach that code through upsiloncli's scripting
// sandbox: `upsilon.call` hard-blocks ANY route name prefixed "admin_"
// (including "admin_login" itself) unless already inside
// `upsilon.adminSection()` (internal/script/bridge.go:110), and
// `adminSection()` always authenticates as the real seeded admin account —
// there is no scripting primitive to call an admin_-prefixed route as a
// non-admin. So every run throws the CLI's own client-side guard before any
// HTTP request is sent — deterministically, not flaky. As a result
// upsilonhub's adminLogin() 403 branch currently has ZERO test coverage
// anywhere in the repo (no Go unit test either).
// What this scenario pins instead is the one thing actually observable end
// -to-end: a non-admin account can never complete an admin login through the
// CLI, whichever layer intercepts it. Recommend (for the orchestrator to
// file): either a scripting escape hatch for negative-path admin testing, or
// a dedicated Go unit test on auth.go:100-103 as an interim mitigation.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;

upsilon.log(`[Bot-${agentIndex}] Starting EC-24: Admin Non-Admin Access`);

// 1. Setup regular (non-admin) user account.
const accountName = "nonadmin_bot_" + botId;
const password = "VerySecurePassword123!";

const regResponse = upsilon.call("auth_register", {
    account_name: accountName,
    email: accountName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: "Test St",
    birth_date: "1990-01-01T00:00:00Z"
});

upsilon.assert(regResponse.user != null, "Registration failed");
upsilon.log(`[Bot-${agentIndex}] Registered regular user account: ${accountName}`);

// 2. Attempt the real admin login route ("admin_login", POST
// /api/v1/auth/admin/login) directly, outside upsilon.adminSection(). Per
// the header note, the CLI's own guard rejects this before it reaches the
// server; the assertion below pins that observable behavior and will start
// failing loudly if the guard is ever relaxed without a matching fix.
let rejected = false;
try {
    upsilon.call("admin_login", {
        account_name: accountName,
        password: password
    });
} catch (e) {
    rejected = true;
    upsilon.assertEquals(
        e.message,
        "security error: route 'admin_login' is administrative and can only be called inside upsilon.adminSection()",
        "Expected the CLI harness's admin-route guard to block a direct admin_login call"
    );
    upsilon.log(`[Bot-${agentIndex}] ✅ admin_login blocked (harness layer — see header note on server-layer coverage gap): ${e.message}`);
}
upsilon.assert(rejected, "ERROR: admin_login call unexpectedly succeeded for a non-admin account!");

upsilon.log(`[Bot-${agentIndex}] EC-24: ADMIN NON-ADMIN ACCESS PASSED.`);
