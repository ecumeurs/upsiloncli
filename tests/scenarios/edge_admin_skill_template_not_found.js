// upsiloncli/tests/scenarios/edge_admin_skill_template_not_found.js
// @test-link [[upsilonapi:api_skill_template_admin_crud]]
//
// Validates that an admin GET on a non-existent skill template returns 404.
//
// GET/PUT/DELETE were previously all exercised here, but all three route
// through the identical `findSkillTemplate` guard clause (admin_content.go)
// as their first action and were confirmed live to produce a byte-for-byte
// identical 404 (same status, same message, same echoed id) — pure
// duplication of one edge, not three. GET is kept as the sharpest form: no
// request body, no mutation side effect. PUT's own code path additionally
// runs body validation before this guard ("422 wins over 404" per
// admin_content.go's updateSkillTemplate comment) — that precedence
// interaction is a distinct, currently-uncovered edge case of its own, not
// tested here since this scenario only ever sent a well-formed body.

upsilon.log("Starting EC: Admin Skill Template Not Found");

upsilon.adminSection((admin) => {
    const fakeId = "00000000-0000-0000-0000-000000000001";

    // GET non-existent
    try {
        admin.call("admin_skill_template_get", { id: fakeId });
        admin.assert(false, "ERROR: GET non-existent template must return 404");
    } catch (e) {
        admin.assertResponse(e, 404, "No query results for model [App\\Models\\SkillTemplate]");
    }
});

upsilon.log("EC: ADMIN SKILL TEMPLATE NOT FOUND PASSED.");
