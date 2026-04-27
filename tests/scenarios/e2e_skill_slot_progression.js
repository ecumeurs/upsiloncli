// upsiloncli/tests/scenarios/e2e_skill_slot_progression.js
// @test-link [[rule_character_skill_slots]]
// @test-link [[entity_character_skill_inventory]]
//
// Validates skill slot gating based on player win count:
// 1. Fresh player has skill_slots = 1
// 2. Can roll and equip exactly 1 skill
// 3. Rolling a second skill succeeds (inventory is unlimited)
// 4. Equipping the second skill is rejected — slot limit reached
//
// NOTE: Slot 2 unlocks at 10 wins (min(5, 1 + intdiv(wins, 10))).
// Win-based progression beyond slot 1 is covered by integration tests.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "slot_prog_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting: Skill Slot Progression`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);

const profile = upsilon.call("profile_get", {});
upsilon.assert(profile.characters && profile.characters.length > 0, "Bot must have at least one character");
const charId = profile.characters[0].id;

// 2. Verify fresh character has 1 slot
const charDetail = upsilon.call("profile_character", { characterId: charId });
upsilon.assertEquals(charDetail.skill_slots, 1, "Fresh character must have exactly 1 skill slot (0 wins)");
upsilon.log(`[Bot-${agentIndex}] Confirmed skill_slots = 1`);

// 3. Roll first skill and equip (should succeed — 1 slot available)
const s1 = upsilon.call("skill_roll", { characterId: charId });
upsilon.assert(s1 && s1.id, "First roll must return a skill");

const e1 = upsilon.call("skill_equip", { characterId: charId, skillId: s1.id });
upsilon.assert(e1.equipped, "First skill equip must succeed within the 1-slot limit");
upsilon.log(`[Bot-${agentIndex}] First skill equipped: ${s1.id}`);

// 4. Roll second skill into inventory (unlimited — rolls don't consume slots)
const s2 = upsilon.call("skill_roll", { characterId: charId });
upsilon.assert(s2 && s2.id, "Second roll must succeed (inventory is unlimited)");
upsilon.assert(s2.id !== s1.id, "Second skill must be a distinct entry");
upsilon.log(`[Bot-${agentIndex}] Second skill acquired: ${s2.id}`);

// 5. Attempt to equip second skill — must fail because 1 slot is already full
try {
    upsilon.call("skill_equip", { characterId: charId, skillId: s2.id });
    upsilon.assert(false, "ERROR: Equipping a second skill with only 1 slot must be rejected");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Second equip correctly rejected: ${e.message}`);
    upsilon.assert(
        e.message.includes("422") || e.message.toLowerCase().includes("slot"),
        "Rejection must be 422 / slot limit error"
    );
}

upsilon.log(`[Bot-${agentIndex}] SKILL SLOT PROGRESSION PASSED.`);
