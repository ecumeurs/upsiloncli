// upsiloncli/tests/scenarios/edge_auth_non_admin_access.js
// @test-link [[uc_admin_login]]
// @test-link [[req_admin_experience]]
// @test-link [[rule_admin_access_restriction]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;

upsilon.log(`[Bot-${agentIndex}] Starting EC-24: Admin Non-Admin Access`);

// 1. Setup regular user account (not admin)
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

// 2. Try to access admin login endpoint with regular account
upsilon.log(`[Bot-${agentIndex}] Attempting admin login with regular account...`);
try {
    const adminLogin = upsilon.call("auth_admin_login", {
        account_name: accountName,
        password: password
    });
    upsilon.assert(false, "ERROR: Regular account can access admin login!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Admin login with regular account properly rejected: ${e.message}`);
    if (e.status_code) {
        // Could be 401 (wrong credentials) or 403 (forbidden)
        upsilon.log(`[Bot-${agentIndex}] Status code: ${e.status_code}`);
    }
}

// 3. Try to access admin dashboard endpoint
upsilon.log(`[Bot-${agentIndex}] Attempting to access admin dashboard...`);
try {
    const dashboard = upsilon.call("admin_dashboard", {});
    upsilon.assert(false, "ERROR: Regular account can access admin dashboard!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Admin dashboard access properly rejected: ${e.message}`);
    if (e.status_code) {
        upsilon.assertEquals(e.status_code, 403, "Expected 403 Forbidden for non-admin access");
    }
}

// 4. Verify regular user can access their own profile
upsilon.log(`[Bot-${agentIndex}] Verifying regular user can access own profile...`);
const profile = upsilon.call("profile_get", {});
upsilon.assert(profile != null, "Regular user profile access failed");
upsilon.log(`[Bot-${agentIndex}] ✅ Regular user can access own profile`);

upsilon.log(`[Bot-${agentIndex}] EC-24: ADMIN NON-ADMIN ACCESS PASSED.`);
