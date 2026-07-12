// upsiloncli/tests/scenarios/edge_skill_equip_invalid_id.js
// @test-link [[upsilonapi:api_character_skill_inventory]]
//
// Validates that equipping a skill ID that does not exist anywhere (well-formed
// UUID, no matching character_skills row) is rejected with the findOrFail 404 —
// distinct from edge_skill_unowned_character_equip.js's 403 (skill exists but
// belongs to someone else's character).

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "invalid_equip_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC: Skill Equip Invalid ID`);

upsilon.bootstrapBot(accountName, password);
const profile = upsilon.call("profile_get", {});
const charId = profile.characters[0].id;

// Use a valid UUID format but a skill that does not exist in this character's inventory
const nonExistentSkillId = "aaaabbbb-cccc-dddd-eeee-ffffffffffff";

// The success/failure verdict is asserted outside the try/catch so an
// unexpected success (no throw at all) can't be silently swallowed by this
// same catch block.
let rejected = false;
try {
    upsilon.call("skill_equip", { characterId: charId, skillId: nonExistentSkillId });
} catch (e) {
    rejected = true;
    upsilon.assertResponse(e, 404, `No query results for model [App\\Models\\CharacterSkill] ${nonExistentSkillId}`);
    upsilon.log(`[Bot-${agentIndex}] ✅ Equip with invalid skill ID rejected: ${e.message}`);
}
upsilon.assert(rejected, "ERROR: Equipping a non-existent skill must be rejected");

upsilon.log(`[Bot-${agentIndex}] EC: SKILL EQUIP INVALID ID PASSED.`);
