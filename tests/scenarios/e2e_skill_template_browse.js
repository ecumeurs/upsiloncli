// upsiloncli/tests/scenarios/e2e_skill_template_browse.js
// @test-link [[api_skill_template_browse]]
// @test-link [[entity_skill_template]]
//
// Validates the player-facing skill template catalog:
// 1. List all available templates — must have at least 3 (seeded)
// 2. Inspect a single template by ID — verify all required fields
// 3. Unavailable templates must not appear in the player listing

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "template_browser_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting: Skill Template Browse`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);

// 2. List templates
const templates = upsilon.call("skill_template_list", {});
upsilon.assert(templates && templates.length >= 3, `Must have at least 3 seeded skill templates, got ${templates ? templates.length : 'null'}`);
upsilon.log(`[Bot-${agentIndex}] Found ${templates.length} templates`);

// All returned templates must be available (player filter)
const unavailable = templates.filter(t => t.available === false);
upsilon.assertEquals(unavailable.length, 0, "Player listing must only return available=true templates");

// 3. Inspect first template — verify required fields
const first = templates[0];
upsilon.assert(first.id, "Template must have an ID");
upsilon.assert(first.name, "Template must have a name");
upsilon.assert(first.behavior, "Template must have a behavior");
upsilon.assert(first.grade, "Template must have a grade");
upsilon.assert(first.targeting !== undefined, "Template must have a targeting map");
upsilon.assert(first.costs !== undefined, "Template must have a costs map");
upsilon.assert(first.effect !== undefined, "Template must have an effect map");

// 4. Fetch individual template by ID
const single = upsilon.call("skill_template_get", { id: first.id });
upsilon.assertEquals(single.id, first.id, "Single template ID must match list entry");
upsilon.assertEquals(single.name, first.name, "Single template name must match list entry");
upsilon.assertEquals(single.behavior, first.behavior, "Single template behavior must match list entry");

upsilon.log(`[Bot-${agentIndex}] Verified template: "${first.name}" (${first.behavior} / Grade ${first.grade})`);
upsilon.log(`[Bot-${agentIndex}] SKILL TEMPLATE BROWSE PASSED.`);
