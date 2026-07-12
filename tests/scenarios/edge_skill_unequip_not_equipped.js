// upsiloncli/tests/scenarios/edge_skill_unequip_not_equipped.js
// @test-link [[upsilonapi:api_character_skill_inventory]]
//
// Validates that trying to unequip a skill that is not currently equipped is rejected.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "unequip_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC: Unequip Not Equipped`);

upsilon.bootstrapBot(accountName, password);
const profile = upsilon.call("profile_get", {});
const charId = profile.characters[0].id;

// Roll a skill — do NOT equip it
const skill = upsilon.call("character_skill_roll", { characterId: charId });
upsilon.assert(skill && skill.id, "Roll must return a skill");
upsilon.assert(!skill.equipped, "Freshly rolled skill must be unequipped");
upsilon.log(`[Bot-${agentIndex}] Skill rolled (unequipped): ${skill.id}`);

// Attempt to unequip a skill that was never equipped — the assert-false-on-
// success lives OUTSIDE the try/catch so an unexpected success can't be
// swallowed by the same catch that's meant to handle the expected rejection.
let rejected = false;
try {
    upsilon.call("skill_unequip", { characterId: charId, skillId: skill.id });
} catch (e) {
    rejected = true;
    upsilon.assertResponse(e, 422, "Skill is not currently equipped.");
    upsilon.log(`[Bot-${agentIndex}] ✅ Unequip of non-equipped skill rejected: ${e.message}`);
}
upsilon.assert(rejected, "ERROR: Unequipping a non-equipped skill was accepted!");

upsilon.log(`[Bot-${agentIndex}] EC: UNEQUIP NOT EQUIPPED PASSED.`);
