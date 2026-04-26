// upsiloncli/tests/scenarios/edge_unequip_empty_slot.js
// @test-link [[api_character_unequip]]
//
// Validates that unequipping an already empty slot returns 404.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "vacuum_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-54: Unequip Empty Slot`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const profile = upsilon.call("profile_get", {});
const charId = profile.characters[0].id;

// 2. Attempt unequip on empty slot
try {
    upsilon.call("character_unequip", { character_id: charId, slot: "weapon" });
    upsilon.assert(false, "ERROR: Unequipping empty slot was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Unequip properly rejected: ${e.message}`);
    upsilon.assert(e.message.includes("404"), "Error must be 404 Not Found");
}

upsilon.log(`[Bot-${agentIndex}] EC-54: UNEQUIP EMPTY SLOT PASSED.`);
