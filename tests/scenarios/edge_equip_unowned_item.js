// upsiloncli/tests/scenarios/edge_equip_unowned_item.js
// @test-link [[upsilonapi:api_equipment_management]]
//
// Validates that a user cannot equip an item they don't own: the inventory
// row genuinely exists and belongs to a real account (User B), so the only
// way User A's equip call can fail is the ownership check in
// equipmentAPI.equip (equipment.go) — `entity.inventory_not_owned`.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;

// User A: The Thief
const accountA = "thief_" + botId;
const passA = "VerySecurePassword123!";
upsilon.bootstrapBot(accountA, passA);
const profileA = upsilon.call("profile_get", {});
const charA = profileA.characters[0].id;

// User B: The Victim — plain register (not bootstrapBot: a second
// bootstrapBot call in the same agent overwrites the single teardown-hook
// slot, so it would delete A's account instead of B's at script end; see
// ISS-114). We need to register B and get an item.
const accountB = "victim_" + botId;
const passB = "VerySecurePassword123!";
upsilon.call("auth_register", {
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
    upsilon.call("character_equip", { characterId: charA, item_id: itemB });
    upsilon.assert(false, "ERROR: Equipping unowned item was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Equip properly rejected: ${e.message} (Status: ${e.status})`);
    upsilon.assertResponse(e, 403, "Inventory item does not belong to you.");
    upsilon.assertEquals(e.meta && e.meta.reason, "inventory_not_owned",
        "Rejection must carry the inventory_not_owned reason");
}

upsilon.log(`[Bot-${agentIndex}] EC-52: EQUIP UNOWNED ITEM PASSED.`);
