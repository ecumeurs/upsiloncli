// upsiloncli/tests/scenarios/edge_equip_wrong_slot.js
// @test-link [[upsilonapi:api_equipment_management]]
//
// Validates the "wrong slot" edge case that actually exists in the API: the
// equip endpoint takes only item_id (slot is always inferred server-side
// from the item's catalog entry, so a client can never request the "wrong"
// slot there). The unequip endpoint is the one that takes a client-supplied
// slot name, and rejects any value outside {armor, utility, weapon} with a
// 422 before doing any slot-state lookup.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "wrongslot_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-51: Equip Wrong Slot`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const profile = upsilon.call("profile_get", {});
const charId = profile.characters[0].id;

// 2. Attempt to unequip a slot name outside {armor, utility, weapon}.
try {
    upsilon.call("character_unequip", { characterId: charId, slot: "boots" });
    upsilon.assert(false, "ERROR: Unequipping an unknown slot name was accepted!");
} catch (e) {
    upsilon.assertResponse(e, 422, "Unknown slot 'boots'.");
    upsilon.log(`[Bot-${agentIndex}] ✅ Unknown slot properly rejected: ${e.message} (Status: ${e.status})`);
}

upsilon.log(`[Bot-${agentIndex}] EC-51: EQUIP WRONG SLOT PASSED.`);
