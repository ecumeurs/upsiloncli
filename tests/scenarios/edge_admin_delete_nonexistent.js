// upsiloncli/tests/scenarios/edge_admin_delete_nonexistent.js
// @test-link [[upsilonapi:uc_admin_user_management]]
// @test-link [[upsilonapi:rule_gdpr_compliance]]
//
// Validates that an admin's soft-delete of a non-existent user (account_name
// with no matching row, trashed-inclusive) returns 404, not a silent no-op.

upsilon.log("Starting EC: Admin Delete Non-Existent User");

upsilon.adminSection((admin) => {
    const nonExistentUser = "user_does_not_exist_" + Date.now();

    try {
        admin.call("admin_user_delete", { account_name: nonExistentUser });
        admin.assert(false, "ERROR: Soft-deleting a non-existent user must return 404");
    } catch (e) {
        admin.assertResponse(e, 404, `No query results for model [App\\Models\\User] ${nonExistentUser}`);
    }
});

upsilon.log("EC: ADMIN DELETE NON-EXISTENT USER PASSED.");
