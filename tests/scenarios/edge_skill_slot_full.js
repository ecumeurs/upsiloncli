// upsiloncli/tests/scenarios/edge_skill_slot_full.js
// @test-link [[upsilontypes:rule_character_skill_slots]]
// @test-link [[upsilonapi:api_character_skill_inventory]]
//
// Validates that equipping beyond the character's skill slot limit is rejected.
// Fresh character has 1 slot (0 wins → min(5, 1 + 0/10)). Equip 1 → success.
// Equip 2nd → 422 ERR_SKILL_SLOT_FULL.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "slot_full_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC: Skill Slot Full`);

upsilon.bootstrapBot(accountName, password);

const profile = upsilon.call("profile_get", {});
const charId = profile.characters[0].id;

// Occupy the only slot
const s1 = upsilon.call("character_skill_roll", { characterId: charId });
upsilon.call("skill_equip", { characterId: charId, skillId: s1.id });
upsilon.log(`[Bot-${agentIndex}] Slot 1 occupied by ${s1.id}`);

// Acquire a second skill (inventory roll always succeeds)
const s2 = upsilon.call("character_skill_roll", { characterId: charId });
upsilon.assert(s2 && s2.id, "Second roll must succeed");

// Attempt to equip — must be rejected (slot full). The success/failure
// verdict is asserted outside the try/catch so an unexpected success (no
// throw at all) can't be silently swallowed by this same catch block.
let rejected = false;
try {
    upsilon.call("skill_equip", { characterId: charId, skillId: s2.id });
} catch (e) {
    rejected = true;
    upsilon.assertResponse(e, 422, "All 1 skill slot(s) are occupied.");
    upsilon.assertEquals(e.meta && e.meta.reason, "ERR_SKILL_SLOT_FULL",
        "Rejection must carry the ERR_SKILL_SLOT_FULL reason");
    upsilon.log(`[Bot-${agentIndex}] ✅ Correctly rejected: ${e.message} (Status: ${e.status})`);
}
upsilon.assert(rejected, "ERROR: Equipping past slot limit must be rejected");

upsilon.log(`[Bot-${agentIndex}] EC: SKILL SLOT FULL PASSED.`);
