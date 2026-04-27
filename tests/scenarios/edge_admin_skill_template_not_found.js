// upsiloncli/tests/scenarios/edge_admin_skill_template_not_found.js
// @test-link [[api_skill_template_admin_crud]]
//
// Validates that admin operations on a non-existent skill template return 404.
// Covers: GET, PUT, DELETE on a missing ID.

upsilon.log("Starting EC: Admin Skill Template Not Found");

const adminLogin = upsilon.call("admin_login", {
    account_name: "admin",
    password: "AdminPassword123!"
});
upsilon.assert(adminLogin && adminLogin.token, "Admin login must succeed");

const fakeId = "00000000-0000-0000-0000-000000000001";

// GET non-existent
try {
    upsilon.call("admin_skill_template_get", { id: fakeId });
    upsilon.assert(false, "ERROR: GET non-existent template must return 404");
} catch (e) {
    upsilon.assertResponse(e, 404, "No query results for model [App\\Models\\SkillTemplate]");
}


// PUT non-existent
try {
    upsilon.call("admin_skill_template_update", { id: fakeId, name: "Ghost" });
    upsilon.assert(false, "ERROR: PUT non-existent template must return 404");
} catch (e) {
    upsilon.assertResponse(e, 404, "No query results for model [App\\Models\\SkillTemplate]");
}


// DELETE non-existent
try {
    upsilon.call("admin_skill_template_delete", { id: fakeId });
    upsilon.assert(false, "ERROR: DELETE non-existent template must return 404");
} catch (e) {
    upsilon.assertResponse(e, 404, "No query results for model [App\\Models\\SkillTemplate]");
}


upsilon.log("EC: ADMIN SKILL TEMPLATE NOT FOUND PASSED.");
