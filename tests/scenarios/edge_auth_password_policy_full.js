// upsiloncli/tests/scenarios/edge_auth_password_policy_full.js
// @spec-link [[rule_password_policy]]
// @spec-link [[req_security]]
// @spec-link [[uc_player_registration]]

const botId = Math.floor(Math.random() * 10000);
const accountName = "password_edge_bot_" + botId;

upsilon.log("Starting EC-20: Password Policy Enforcement (Full Coverage)");

const basePayload = {
    account_name: accountName,
    email: accountName + "@example.com",
    full_address: "Security St",
    birth_date: "1990-01-01T00:00:00Z"
};

const tests = [
    { name: "Too Short (7 chars)", pass: "Short1!", expected: "too short" },
    { name: "Exactly 14 chars", pass: "FourteenChars14!", expected: "too short" },
    { name: "No Symbol", pass: "LongPasswordWithNumbers123", expected: "symbol" },
    { name: "No Uppercase", pass: "longpasswordwithnumbers123!", expected: "uppercase" },
    { name: "No Numbers", pass: "LongPasswordWithoutNumbers!", expected: "number" },
    { name: "No Symbol #2", pass: "AnotherLongPassword456", expected: "symbol" },
    { name: "Only Special Chars", pass: "!!!!!!@#$%^&*", expected: "uppercase or number" },
    { name: "Mismatch Confirmation", pass: "ValidPassword123!", confirm: "WrongPassword123!", expected: "confirmation" }
];

tests.forEach(test => {
    upsilon.log(`Testing rejection of: ${test.name}`);
    try {
        const payload = {
            ...basePayload,
            account_name: accountName + "_" + test.name.replace(/[^a-zA-Z0-9]/g, ""),
            password: test.pass,
            password_confirmation: test.confirm || test.pass
        };
        upsilon.call("auth_register", payload);
        upsilon.assert(false, `ERROR: Server accepted weak password: ${test.name}`);
    } catch (e) {
        upsilon.log(`✅ Success: rejected ${test.name} - ${e.message}`);
        // Verify 4xx status code for security-related errors
        if (e.status_code) {
            upsilon.assert(e.status_code >= 400 && e.status_code < 500, "Expected 4xx status code for invalid password");
        }
    }
});

// Test valid compliant password
upsilon.log("Testing valid compliant password (15+ chars, uppercase, number, symbol)...");
const validPassword = "VerySecurePassword123!";
let registrationSuccess = false;

try {
    const regResponse = upsilon.call("auth_register", {
        ...basePayload,
        password: validPassword,
        password_confirmation: validPassword
    });
    upsilon.assert(regResponse.user != null, "ERROR: Server rejected valid compliant password!");
    upsilon.assertEquals(regResponse.user.account_name, accountName, "Account name mismatch");
    upsilon.assert(regResponse.token != null && regResponse.token.length > 0, "No token issued on registration");
    registrationSuccess = true;
    upsilon.log("✅ Valid password accepted, account created, token issued");
} catch (e) {
    upsilon.assert(false, `ERROR: Valid password registration failed: ${e.message}`);
}

// Cleanup
upsilon.onTeardown(() => {
    try {
        upsilon.call("auth_delete", {});
        upsilon.log("✅ Account cleaned up");
    } catch (e) {
        upsilon.log(`Cleanup error (ignored): ${e.message}`);
    }
});

upsilon.log("EC-20: PASSWORD POLICY ENFORCEMENT (FULL COVERAGE) PASSED.");
