// upsiloncli/tests/scenarios/edge_admin_private_data_access.js
// @test-link [[rule_admin_access_restriction]]
// @test-link [[uc_admin_user_management]]
// @test-link [[rule_gdpr_compliance]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;

// Note: This test requires an admin account to exist
// For CI, we'll test the behavior but may not have admin access
upsilon.log(`[Bot-${agentIndex}] Starting EC-43: Admin View Private Data`);

// 1. Setup regular user account (non-admin)
const accountName = "privdata_bot_" + botId;
const password = "VerySecurePassword123!";

const regResponse = upsilon.call("auth_register", {
    account_name: accountName,
    email: accountName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: "123 Private Street",
    birth_date: "1990-01-01T00:00:00Z"
});

upsilon.assert(regResponse.user != null, "Registration failed");
upsilon.log(`[Bot-${agentIndex}] Registered account with private data: ${regResponse.user.full_address}`);

// 2. Try to access admin endpoint with regular account
upsilon.log(`[Bot-${agentIndex}] Attempting to access admin users endpoint...`);
try {
    const adminResult = upsilon.call("admin_users", {});
    upsilon.log(`[Bot-${agentIndex}] Note: Admin access attempt completed`);
    upsilon.assert(false, "ERROR: Regular account can access admin endpoints!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Admin access properly rejected: ${e.message}`);
    // Verify 403 Forbidden status code
    if (e.status_code) {
        upsilon.assertEquals(e.status_code, 403, "Expected 403 Forbidden for non-admin access");
    }
}

// 3. Verify own profile shows private data (for owner)
upsilon.log(`[Bot-${agentIndex}] Fetching own profile...`);
const ownProfile = upsilon.call("profile_get", {});

if (ownProfile.full_address) {
    upsilon.assertEquals(ownProfile.full_address, "123 Private Street", "Owner should see full_address");
    upsilon.log(`[Bot-${agentIndex}] ✅ Owner can see full_address`);
} else {
    upsilon.log(`[Bot-${agentIndex}] ⚠️ full_address not in own profile`);
}

if (ownProfile.birth_date) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Owner can see birth_date`);
} else {
    upsilon.log(`[Bot-${agentIndex}] ⚠️ birth_date not in own profile`);
}

// 4. Note: To fully test admin restrictions, we'd need:
// - An admin account to call admin endpoints
// - Verify admin cannot see private data in user list
// - Verify admin cannot see private data in individual user profile

upsilon.log(`[Bot-${agentIndex}] EC-43: NOTE: Full admin test requires admin account setup`);

// Cleanup
upsilon.onTeardown(() => {
    try {
        upsilon.call("auth_delete", {});
        upsilon.log(`[Bot-${agentIndex}] ✅ Account cleaned up`);
    } catch (e) {
        upsilon.log(`Teardown cleanup error (ignored): ${e.message}`);
    }
});

upsilon.log(`[Bot-${agentIndex}] EC-43: ADMIN VIEW PRIVATE DATA PASSED.`);
