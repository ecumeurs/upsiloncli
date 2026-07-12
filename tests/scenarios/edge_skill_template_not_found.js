// upsiloncli/tests/scenarios/edge_skill_template_not_found.js
// @test-link [[upsilonapi:api_skill_template_browse]]
//
// Validates that requesting a non-existent skill template returns 404.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "tpl_404_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC: Skill Template Not Found`);

upsilon.bootstrapBot(accountName, password);

// Use a well-formed but non-existent UUID
const fakeId = "00000000-0000-0000-0000-000000000000";

let rejected = false;
try {
    upsilon.call("skill_template_get", { id: fakeId });
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Non-existent template rejected: ${e.message}`);
    upsilon.assertResponse(e, 404, "No query results for model");
    rejected = true;
}
upsilon.assert(rejected, "ERROR: Fetching non-existent template must return 404");

upsilon.log(`[Bot-${agentIndex}] EC: SKILL TEMPLATE NOT FOUND PASSED.`);
