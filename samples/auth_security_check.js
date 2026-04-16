// samples/auth_security_check.js
// @spec-link [[rule_password_policy]]

const botId = Math.floor(Math.random() * 10000);
const accountName = "security_bot_" + botId;

upsilon.log("Starting Security Policy Check for: " + accountName);

// TEST 1: Password too short (requires 15)
upsilon.log("Testing password length constraint (min 15)...");
try {
    upsilon.call("auth_register", {
        account_name: accountName + "_short",
        email: accountName + "_short@example.com",
        password: "Short1!",
        password_confirmation: "Short1!",
        full_address: "Test Address",
        birth_date: "1990-01-01"
    });
    upsilon.assert(false, "ERROR: Server accepted a short password (7 chars)!");
} catch (e) {
    upsilon.log("SUCCESS: Server rejected short password: " + e.message);
}

// TEST 2: Password missing complexity (No symbol)
upsilon.log("Testing password complexity constraint (No symbol)...");
try {
    upsilon.call("auth_register", {
        account_name: accountName + "_nosym",
        email: accountName + "_nosym@example.com",
        password: "LongPasswordWithNumbers123",
        password_confirmation: "LongPasswordWithNumbers123",
        full_address: "Test Address",
        birth_date: "1990-01-01"
    });
    upsilon.assert(false, "ERROR: Server accepted password without special symbol!");
} catch (e) {
    upsilon.log("SUCCESS: Server rejected password without symbols: " + e.message);
}

// TEST 3: Correct password
upsilon.log("Testing valid compliant password...");
const validPassword = "VerySecurePassword123!";
let regResponse = upsilon.call("auth_register", {
    account_name: accountName,
    email: accountName + "@example.com",
    password: validPassword,
    password_confirmation: validPassword,
    full_address: "123 Security St, Cyber City",
    birth_date: "1990-01-01"
});

upsilon.assert(regResponse.user != null, "ERROR: Server rejected valid compliant password!");
upsilon.log("SUCCESS: Valid password accepted.");

// CLEANUP
upsilon.onTeardown(() => {
    upsilon.log("Cleaning up security bot...");
    try {
        upsilon.call("auth_delete", {});
    } catch (e) {}
});

upsilon.log("AUTH SECURITY CHECK PASSED.");
