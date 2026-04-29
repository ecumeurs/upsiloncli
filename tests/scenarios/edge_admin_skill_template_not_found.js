// upsiloncli/tests/scenarios/edge_admin_skill_template_not_found.js
// @test-link [[api_skill_template_admin_crud]]
//
// Validates that admin operations on a non-existent skill template return 404.
// Covers: GET, PUT, DELETE on a missing ID.

upsilon.log("Starting EC: Admin Skill Template Not Found");

// @spec-link [[mech_script_admin_section]]
upsilon.adminSection((admin) => {
    const fakeId = "00000000-0000-0000-0000-000000000001";

    // GET non-existent
    try {
        admin.call("admin_skill_template_get", { id: fakeId });
        admin.assert(false, "ERROR: GET non-existent template must return 404");
    } catch (e) {
        admin.assertResponse(e, 404, "No query results for model [App\\Models\\SkillTemplate]");
    }


    // PUT non-existent
    try {
        admin.call("admin_skill_template_update", { id: fakeId, name: "Ghost" });
        admin.assert(false, "ERROR: PUT non-existent template must return 404");
    } catch (e) {
        admin.assertResponse(e, 404, "No query results for model [App\\Models\\SkillTemplate]");
    }


    // DELETE non-existent
    try {
        admin.call("admin_skill_template_delete", { id: fakeId });
        admin.assert(false, "ERROR: DELETE non-existent template must return 404");
    } catch (e) {
        admin.assertResponse(e, 404, "No query results for model [App\\Models\\SkillTemplate]");
    }
});

upsilon.log("EC: ADMIN SKILL TEMPLATE NOT FOUND PASSED.");
