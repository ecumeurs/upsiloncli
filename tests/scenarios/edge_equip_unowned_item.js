// upsiloncli/tests/scenarios/edge_equip_unowned_item.js
// @test-link [[api_character_equip]]
//
// Validates that a user cannot equip an item they don't own.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;

// User A: The Thief
const accountA = "thief_" + botId;
const passA = "VerySecurePassword123!";
upsilon.bootstrapBot(accountA, passA);
const profileA = upsilon.call("profile_get", {});
const charA = profileA.characters[0].id;

// User B: The Victim
const accountB = "victim_" + botId;
const passB = "VerySecurePassword123!";
// We need to register B and get an item
const regB = upsilon.call("auth_register", {
    account_name: accountB,
    email: accountB + "@example.com",
    password: passB,
    password_confirmation: passB,
    full_address: "Test",
    birth_date: "1990-01-01T00:00:00Z"
});
upsilon.call("auth_login", { account_name: accountB, password: passB });
const items = upsilon.call("shop_browse", {});
const armor = items.find(i => i.slot === "armor");
upsilon.call("shop_purchase", { shop_item_id: armor.id });
const invB = upsilon.call("profile_inventory", {});
const itemB = invB[0].id;

// Back to User A
upsilon.call("auth_login", { account_name: accountA, password: passA });

upsilon.log(`[Bot-${agentIndex}] Starting EC-52: Equip Unowned Item`);

// Attempt to equip User B's item to User A's character
try {
    upsilon.call("character_equip", { character_id: charA, item_id: itemB });
    upsilon.assert(false, "ERROR: Equipping unowned item was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Equip properly rejected: ${e.message}`);
    upsilon.assert(e.message.includes("403") || e.message.includes("404"), "Error must be 403 Forbidden or 404 Not Found");
}

upsilon.log(`[Bot-${agentIndex}] EC-52: EQUIP UNOWNED ITEM PASSED.`);
