// upsiloncli/tests/scenarios/edge_auth_password_policy_full.js
// @test-link [[rule_password_policy]]
//
// The "full" edge here is the strictest boundary of rule_password_policy
// itself: one password that violates every dimension of the rule at once
// (too short, no uppercase, no digit, no symbol) in a single registration
// call, proving the server accumulates and reports all policy violations
// together rather than short-circuiting on the first one. Per-dimension
// sweeps (length-only, symbol-only, etc.) belong to the broader E2E coverage
// in e2e_password_policy.js; password-confirmation mismatch is a different
// validator (checkConfirmed) and not part of this rule, so it is out of
// scope for this file.

const botId = Math.floor(Math.random() * 10000);
const accountName = "password_edge_bot_" + botId;

upsilon.log("Starting EC-20: Password Policy — worst-case boundary (all rules violated at once)");

const basePayload = {
    account_name: accountName,
    email: accountName + "@example.com",
    full_address: "Security St",
    birth_date: "1990-01-01T00:00:00Z"
};

// Deliberately violates all four rule_password_policy dimensions at once:
// 8 chars (< 15), all lowercase (no uppercase), no digit, no symbol.
const worstCasePassword = "shortpwd";

upsilon.log("Testing rejection of a password violating length + uppercase + number + symbol simultaneously...");
try {
    upsilon.call("auth_register", {
        ...basePayload,
        password: worstCasePassword,
        password_confirmation: worstCasePassword
    });
    upsilon.assert(false, "ERROR: Server accepted a password violating every policy dimension!");
} catch (e) {
    upsilon.assertResponse(e, 422);
    const errors = e.meta && e.meta.errors ? JSON.stringify(e.meta.errors) : "";
    ["least 15", "uppercase", "number", "symbol"].forEach(expected => {
        upsilon.assert(errors.includes(expected), `Expected error to contain "${expected}", but got: ${errors}`);
    });
    upsilon.log("✅ Success: all four policy violations reported in one response");
}

// Control: a fully compliant password must still be accepted.
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

upsilon.log("EC-20: PASSWORD POLICY ENFORCEMENT (WORST-CASE BOUNDARY) PASSED.");
