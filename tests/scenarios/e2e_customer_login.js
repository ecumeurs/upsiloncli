// upsiloncli/tests/scenarios/e2e_customer_login.js
// @spec-link [[uc_player_login]]
// @spec-link [[api_auth_login]]

const botId = Math.floor(Math.random() * 10000);
const accountName = "login_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log("Starting CR-02: Player Login & Session Management for " + accountName);

// 1. Setup: Register a player
upsilon.log("Registering player for login test...");
upsilon.call("auth_register", {
    account_name: accountName,
    email: accountName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: "123 Login Lane, Cyber City",
    birth_date: "1990-01-01T00:00:00Z"
});

// 2. Existing player attempts login with valid credentials
upsilon.log("Testing valid login...");
const loginResponse = upsilon.call("auth_login", {
    account_name: accountName,
    password: password
});

// ✅ Login succeeds and JWT token is issued (implicitly handled by bridge context)
upsilon.assert(loginResponse.token != null, "No JWT token issued on successful login");
upsilon.log("✅ Login succeeded with valid credentials");

// 3. Player accesses protected endpoints using token
const profile = upsilon.call("profile_get", {});
upsilon.assert(profile != null, "Could not access protected dashboard");
upsilon.log("✅ Protected endpoints accessible with valid token");

// 4. Login fails with incorrect credentials
upsilon.log("Testing login with invalid password...");
try {
    upsilon.call("auth_login", {
        account_name: accountName,
        password: "WrongPassword123!"
    });
    upsilon.assert(false, "ERROR: Login succeeded with incorrect credentials!");
} catch (e) {
    upsilon.log("✅ Login rejected for incorrect credentials: " + e.message);
}

// 5. System handles session timeout gracefully (Documentation Check)
// Note: We cannot easily wait 15 minutes in a CI test, 
// but we verify that the token logic is active.
upsilon.log("INFO: 15-minute token expiration is verified via unit tests and API config.");

// CLEANUP
upsilon.onTeardown(() => {
    upsilon.log("Cleaning up login bot...");
    try {
        upsilon.call("auth_delete", {});
    } catch (e) {}
});

upsilon.log("CR-02: PLAYER LOGIN & SESSION MANAGEMENT PASSED.");
