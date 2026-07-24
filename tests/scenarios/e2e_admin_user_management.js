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

// @spec-link [[mechanic_script_admin_section]]
upsilon.adminSection((admin) => {
    admin.log("✅ Admin access granted! Fetching user registry...");

    // 2. Fetch User List
    const users = admin.call("admin_users", {});
    admin.assert(users.items != null, "Items missing from user response");
    
    // Find our target bot in the list
    const target = users.items.find(u => u.account_name === targetBotName);
    admin.assert(target != null, "Target bot must be in registry");
    admin.log(`Testing anonymization on: ${target.account_name}`);

    // 4. Trigger Anonymize. admin.call throws on a non-2xx envelope, so reaching
    //    the next line already means the server accepted it; the endpoint returns
    //    an empty data payload (the success text rides the envelope message, which
    //    admin.call does not surface) — so we verify the effect by re-reading the
    //    registry rather than the response.
    admin.call("admin_user_anonymize", { account_name: target.account_name });
    admin.log(`Anonymization triggered for: ${target.account_name}`);

    // 5. Verify PII was overwritten. account_name is preserved by anonymize, and
    //    the now-soft-deleted row still lists under the default with_trashed view.
    const after = admin.call("admin_users", {});
    const anonymized = after.items.find(u => u.account_name === targetBotName);
    admin.assert(anonymized != null, "Anonymized account must still list (soft-deleted)");
    admin.assert(anonymized.full_address === "ANONYMIZED", "Address must be overwritten with ANONYMIZED");
    admin.assert(anonymized.deleted_at != null, "Anonymize must soft-delete the account");
    admin.log(`✅ Verified anonymization of: ${anonymized.account_name}`);
});

upsilon.log("CR-15: ADMIN USER MANAGEMENT PASSED.");
