// upsiloncli/tests/scenarios/edge_admin_anonymize_nonexistent.js
// @test-link [[upsilonapi:uc_admin_user_management]]
//
// Validates that an admin's GDPR anonymize action on a non-existent
// account_name returns a 404, without ever reaching the anonymization logic.

upsilon.log("Starting EC: Admin Anonymize Non-Existent User");

upsilon.adminSection((admin) => {
    const nonExistentUser = "user_does_not_exist_" + Date.now();

    try {
        admin.call("admin_user_anonymize", { account_name: nonExistentUser });
        admin.assert(false, "ERROR: Anonymize of non-existent user must return 404");
    } catch (e) {
        admin.assertResponse(e, 404, `No query results for model [App\\Models\\User] ${nonExistentUser}`);
    }
});

upsilon.log("EC: ADMIN ANONYMIZE NON-EXISTENT USER PASSED.");
