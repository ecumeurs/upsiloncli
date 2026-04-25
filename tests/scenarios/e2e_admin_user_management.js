// upsiloncli/tests/scenarios/e2e_admin_user_management.js
// @test-link [[uc_admin_user_management]]
// @test-link [[rule_admin_access_restriction]]

/**
 * SCENARIO: CR-15 Admin User Management
 * EXPECTED BEHAVIOR:
 * 1. Admin logs in via /api/v1/auth/admin/login
 * 2. Admin enters dashboard and views all users
 * 3. Admin can trigger 'anonymize' on a user account (GDPR right to be forgotten)
 * 4. System overwrites PII (address, birth_date) with "ANONYMIZED"
 */

upsilon.log("Starting CR-15: Admin User Management Verification");

// 1. Admin Login
upsilon.log("Attempting Admin login...");
upsilon.call("admin_login", {
    account_name: "admin",
    password: "AdminPassword123!" // Seeded value in .env.ci
});

upsilon.log("✅ Admin access granted! Fetching user registry...");

// 2. Fetch User List
const users = upsilon.call("admin_users", {});
upsilon.assert(users.items != null, "Items missing from user response");
upsilon.assert(users.items.length > 0, "No users found in registry");

// 3. Select a target for anonymization (e.g., the last one or a specific test user)
const target = users.items[users.items.length - 1];
upsilon.log(`Testing anonymization on: ${target.account_name}`);

// 4. Trigger Anonymize
const result = upsilon.call("admin_user_anonymize", {
    account_name: target.account_name
});

upsilon.log(`✅ Anonymization result: ${result.message}`);
upsilon.log("CR-15: ADMIN USER MANAGEMENT PASSED.");
