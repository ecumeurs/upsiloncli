// upsiloncli/tests/scenarios/e2e_admin_skill_crud.js
// @test-link [[api_skill_template_admin_crud]]
// @test-link [[rule_admin_content_authority]]
//
// Validates the admin skill template CRUD lifecycle:
// 1. Admin login
// 2. Create a skill template
// 3. List — verify template appears
// 4. Get by ID — verify fields
// 5. Update name and grade
// 6. Get again — verify changes persisted
// 7. Delete
// 8. List again — verify gone

upsilon.log("Starting: Admin Skill Template CRUD");

// 1. Admin login
const adminLogin = upsilon.call("admin_login", {
    account_name: "admin",
    password: "AdminPassword123!"
});
upsilon.assert(adminLogin && adminLogin.token, "Admin login must return a token");
upsilon.log("Admin authenticated.");

// 2. Create
const uniqueName = "E2E_Skill_" + Math.floor(Math.random() * 100000);
const created = upsilon.call("admin_skill_template_create", {
    name: uniqueName,
    behavior: "Direct",
    grade: "II",
    weight_positive: "8",
    weight_negative: "3",
    available: "true"
});
upsilon.assert(created && created.id, "Created template must have an ID");
upsilon.assertEquals(created.name, uniqueName, "Created name must match input");
upsilon.assertEquals(created.behavior, "Direct", "Behavior must be Direct");
upsilon.assertEquals(created.grade, "II", "Grade must be II");
upsilon.assert(created.available === true, "Template must be available by default");
upsilon.log(`Template created: ${created.id}`);

// 3. List — must appear
const list = upsilon.call("admin_skill_template_list", {});
upsilon.assert(list && list.length > 0, "Admin template list must not be empty");
const found = list.find(t => t.id === created.id);
upsilon.assert(found, "Created template must appear in admin list");

// 4. Get by ID
const fetched = upsilon.call("admin_skill_template_get", { id: created.id });
upsilon.assertEquals(fetched.id, created.id, "Fetched template ID must match");
upsilon.assertEquals(fetched.name, uniqueName, "Fetched name must match");

// 5. Update
const updatedName = uniqueName + "_Updated";
upsilon.call("admin_skill_template_update", {
    id: created.id,
    name: updatedName,
    grade: "III",
    available: "false"
});
upsilon.log("Template updated.");

// 6. Verify update persisted
const afterUpdate = upsilon.call("admin_skill_template_get", { id: created.id });
upsilon.assertEquals(afterUpdate.name, updatedName, "Updated name must persist");
upsilon.assertEquals(afterUpdate.grade, "III", "Updated grade must persist");
upsilon.assert(afterUpdate.available === false, "Updated available=false must persist");

// 7. Delete
upsilon.call("admin_skill_template_delete", { id: created.id });
upsilon.log("Template deleted.");

// 8. Verify gone — list should not contain it
const afterDelete = upsilon.call("admin_skill_template_list", {});
const stillFound = afterDelete.find(t => t.id === created.id);
upsilon.assert(!stillFound, "Deleted template must not appear in list");

upsilon.log("ADMIN SKILL TEMPLATE CRUD PASSED.");
