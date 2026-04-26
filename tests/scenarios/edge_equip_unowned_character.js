// upsiloncli/tests/scenarios/edge_equip_unowned_character.js
// @test-link [[api_character_equip]]
//
// Validates that a user cannot equip an item to a character they don't own.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;

// User A: The Victim
const accountA = "victim_char_" + botId;
const passA = "Pass123!";
upsilon.bootstrapBot(accountA, passA);
const profileA = upsilon.call("profile_get", {});
const charA = profileA.characters[0].id;

// User B: The Hacker
const accountB = "hacker_char_" + botId;
const passB = "Pass123!";
upsilon.bootstrapBot(accountB, passB);
const items = upsilon.call("shop_browse", {});
const armor = items.find(i => i.slot === "armor");
upsilon.call("shop_purchase", { shop_item_id: armor.id });
const invB = upsilon.call("profile_inventory", {});
const itemB = invB[0].id;

upsilon.log(`[Bot-${agentIndex}] Starting EC-53: Equip Unowned Character`);

// Attempt to equip User B's item to User A's character
try {
    upsilon.call("character_equip", { character_id: charA, item_id: itemB });
    upsilon.assert(false, "ERROR: Equipping to unowned character was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Equip properly rejected: ${e.message}`);
    upsilon.assert(e.message.includes("403") || e.message.includes("404"), "Error must be 403 Forbidden or 404 Not Found");
}

upsilon.log(`[Bot-${agentIndex}] EC-53: EQUIP UNOWNED CHARACTER PASSED.`);
