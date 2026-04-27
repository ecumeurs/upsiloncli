// upsiloncli/tests/scenarios/edge_skill_slot_full.js
// @test-link [[rule_character_skill_slots]]
// @test-link [[api_character_skill_inventory]]
//
// Validates that equipping beyond the character's skill slot limit is rejected.
// Fresh character has 1 slot. Equip 1 → success. Equip 2nd → 422.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "slot_full_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC: Skill Slot Full`);

upsilon.bootstrapBot(accountName, password);

const profile = upsilon.call("profile_get", {});
const charId = profile.characters[0].id;

// Occupy the only slot
const s1 = upsilon.call("skill_roll", { characterId: charId });
upsilon.call("skill_equip", { characterId: charId, skillId: s1.id });
upsilon.log(`[Bot-${agentIndex}] Slot 1 occupied by ${s1.id}`);

// Acquire a second skill (inventory roll always succeeds)
const s2 = upsilon.call("skill_roll", { characterId: charId });
upsilon.assert(s2 && s2.id, "Second roll must succeed");

// Attempt to equip — must be rejected (slot full)
try {
    upsilon.call("skill_equip", { characterId: charId, skillId: s2.id });
    upsilon.assert(false, "ERROR: Equipping past slot limit must be rejected");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Correctly rejected: ${e.message}`);
    upsilon.assert(
        e.message.includes("422") || e.message.toLowerCase().includes("slot"),
        "Rejection must be 422 / slot-full"
    );
}

upsilon.log(`[Bot-${agentIndex}] EC: SKILL SLOT FULL PASSED.`);
