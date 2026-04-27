// upsiloncli/tests/scenarios/edge_skill_equip_invalid_id.js
// @test-link [[api_character_skill_inventory]]
//
// Validates that equipping a skill UUID that does not belong to the character is rejected.

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

try {
    upsilon.call("skill_equip", { characterId: charId, skillId: nonExistentSkillId });
    upsilon.assert(false, "ERROR: Equipping a non-existent skill must be rejected");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Equip with invalid skill ID rejected: ${e.message}`);
    upsilon.assert(
        e.message.includes("404") || e.message.includes("422") || e.message.includes("403"),
        "Must be 404, 422, or 403"
    );
}

upsilon.log(`[Bot-${agentIndex}] EC: SKILL EQUIP INVALID ID PASSED.`);
