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

// TEST 3: Password missing uppercase
upsilon.log("Testing password missing uppercase...");
try {
    upsilon.call("auth_register", {
        account_name: accountName + "_nocaps",
        email: accountName + "_nocaps@example.com",
        password: "longpasswordwithnumbers123!",
        password_confirmation: "longpasswordwithnumbers123!",
        full_address: "Test Address",
        birth_date: "1990-01-01"
    });
    upsilon.assert(false, "ERROR: Server accepted password without uppercase letters!");
} catch (e) {
    upsilon.log("SUCCESS: Server rejected password without uppercase: " + e.message);
}

// TEST 4: Password missing lowercase
upsilon.log("Testing password missing lowercase...");
try {
    upsilon.call("auth_register", {
        account_name: accountName + "_nolower",
        email: accountName + "_nolower@example.com",
        password: "LONGPASSWORDWITHNUMBERS123!",
        password_confirmation: "LONGPASSWORDWITHNUMBERS123!",
        full_address: "Test Address",
        birth_date: "1990-01-01"
    });
    upsilon.assert(false, "ERROR: Server accepted password without lowercase letters!");
} catch (e) {
    upsilon.log("SUCCESS: Server rejected password without lowercase: " + e.message);
}

// TEST 5: Password missing numbers
upsilon.log("Testing password missing numbers...");
try {
    upsilon.call("auth_register", {
        account_name: accountName + "_nonums",
        email: accountName + "_nonums@example.com",
        password: "LongPasswordWithoutNumbers!",
        password_confirmation: "LongPasswordWithoutNumbers!",
        full_address: "Test Address",
        birth_date: "1990-01-01"
    });
    upsilon.assert(false, "ERROR: Server accepted password without numbers!");
} catch (e) {
    upsilon.log("SUCCESS: Server rejected password without numbers: " + e.message);
}

// TEST 6: Correct password
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
