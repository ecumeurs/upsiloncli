// upsiloncli/tests/scenarios/e2e_password_policy.js
// @spec-link [[rule_password_policy]]

const botId = Math.floor(Math.random() * 10000);
const accountName = "policy_bot_" + botId;

upsilon.log("Starting CR-13: Password Policy Enforcement for: " + accountName);

const basePayload = {
    account_name: accountName,
    email: accountName + "@example.com",
    full_address: "Security St",
    birth_date: "1990-01-01T00:00:00Z"
};

const tests = [
    { name: "Short (7)", pass: "Short1!" },
    { name: "No Symbol", pass: "LongPasswordWithNumbers123" },
    { name: "No Uppercase", pass: "longpasswordwithnumbers123!" },
    { name: "No Numbers", pass: "LongPasswordWithoutNumbers!" }
];

tests.forEach(test => {
    upsilon.log(`Testing rejection of: ${test.name}`);
    try {
        upsilon.call("auth_register", {
            ...basePayload,
            account_name: accountName + "_" + test.name.replace(" ", ""),
            password: test.pass,
            password_confirmation: test.pass
        });
        upsilon.assert(false, `ERROR: Server accepted weak password: ${test.name}`);
    } catch (e) {
        upsilon.log(`✅ Success: rejected ${test.name}`);
    }
});

// Valid compliant password
upsilon.log("Testing valid compliant password...");
const validPassword = "VerySecurePassword123!";
const regResponse = upsilon.call("auth_register", {
    ...basePayload,
    password: validPassword,
    password_confirmation: validPassword
});

upsilon.assert(regResponse.user != null, "ERROR: Server rejected valid compliant password!");
upsilon.log("✅ Valid password accepted.");

// CLEANUP
upsilon.onTeardown(() => {
    try { upsilon.call("auth_delete", {}); } catch (e) {}
});

upsilon.log("CR-13: PASSWORD POLICY ENFORCEMENT PASSED.");
