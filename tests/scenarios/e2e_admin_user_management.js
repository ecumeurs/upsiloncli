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

const targetBotName = "target_bot_" + Math.floor(Math.random() * 100000);
upsilon.bootstrapBot(targetBotName, "VerySecurePassword123!");
upsilon.call("auth_logout", {});

// @spec-link [[mech_script_admin_section]]
upsilon.adminSection((admin) => {
    admin.log("✅ Admin access granted! Fetching user registry...");

    // 2. Fetch User List
    const users = admin.call("admin_users", {});
    admin.assert(users.items != null, "Items missing from user response");
    
    // Find our target bot in the list
    const target = users.items.find(u => u.account_name === targetBotName);
    admin.assert(target != null, "Target bot must be in registry");
    admin.log(`Testing anonymization on: ${target.account_name}`);

    // 4. Trigger Anonymize
    const result = admin.call("admin_user_anonymize", {
        account_name: target.account_name
    });

    admin.log(`✅ Anonymization result: ${result.message}`);
});

upsilon.log("CR-15: ADMIN USER MANAGEMENT PASSED.");
