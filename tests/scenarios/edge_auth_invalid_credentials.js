// upsiloncli/tests/scenarios/edge_auth_invalid_credentials.js
// @test-link [[api_auth_login]]
// @test-link [[uc_player_login]]
// @test-link [[req_security_authorization]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "invalidcred_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-21: Invalid Credentials`);

// 1. Register account
const regResponse = upsilon.call("auth_register", {
    account_name: accountName,
    email: accountName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: "Test St",
    birth_date: "1990-01-01T00:00:00Z"
});

upsilon.assert(regResponse.user != null, "Registration failed");

// 2. Test login with wrong password
upsilon.log(`[Bot-${agentIndex}] Attempting login with wrong password...`);
try {
    upsilon.call("auth_login", {
        account_name: accountName,
        password: "WrongPassword123!"
    });
    upsilon.assert(false, "ERROR: Wrong password login was accepted!");
} catch (e) {
    upsilon.assertResponse(e, 401, "Invalid credentials.");
    upsilon.log(`[Bot-${agentIndex}] ✅ Wrong password properly rejected`);
}


// 3. Test login with wrong account name
upsilon.log(`[Bot-${agentIndex}] Attempting login with wrong account name...`);
try {
    upsilon.call("auth_login", {
        account_name: "user_does_not_exist_" + Date.now(),
        password: password
    });
    upsilon.assert(false, "ERROR: Wrong account name login was accepted!");
} catch (e) {
    upsilon.assertResponse(e, 401, "Invalid credentials.");
    upsilon.log(`[Bot-${agentIndex}] ✅ Wrong account name properly rejected`);
}


// 4. Verify correct credentials still work
upsilon.log(`[Bot-${agentIndex}] Attempting login with correct credentials...`);
const validLogin = upsilon.call("auth_login", {
    account_name: accountName,
    password: password
});

upsilon.assert(validLogin.user != null, "Correct credentials login failed");
upsilon.assert(validLogin.token != null, "No token issued for valid login");
upsilon.log(`[Bot-${agentIndex}] ✅ Valid login succeeded, token length: ${validLogin.token.length}`);

// Cleanup
upsilon.onTeardown(() => {
    try {
        upsilon.call("auth_delete", {});
        upsilon.log(`[Bot-${agentIndex}] ✅ Account cleaned up`);
    } catch (e) {
        upsilon.log(`Teardown cleanup error (ignored): ${e.message}`);
    }
});

upsilon.log(`[Bot-${agentIndex}] EC-21: INVALID CREDENTIALS PASSED.`);
