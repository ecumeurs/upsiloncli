// upsiloncli/tests/scenarios/edge_quantity_cap_99.js
// @test-link [[upsilonapi:rule_quantity_cap]]
//
// Validates the inventory quantity cap: player_inventory.quantity is
// hard-capped at 99 per item per user (ShopService::purchase / pg_inventory.go).
// A purchase that would push the owned quantity past 99 must be rejected
// (422, meta.reason="quantity_cap") with no partial fulfillment; landing
// exactly on 99 must succeed.
//
// The cap is on *total owned quantity*, not on any single purchase request,
// so hitting it with the real catalog (Basic Armor, 200 CR) would need
// 99 * 200 = 19,800 CR -- far beyond the 1000 CR starting balance and not
// worth a slow credit grind in CI. Instead this uses the admin shop-item CRUD
// (same pattern proven in e2e_admin_shop_item_crud.js) to create a disposable
// 1-credit item, so the cap is reachable in a single 99-unit purchase (99 CR
// total) well within the seeded starting balance.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "hoarder_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-55: Quantity Cap (99)`);

// 1. Admin creates a throwaway 1-credit item so the cap is reachable within
//    the account's starting credits.
let itemId;
upsilon.adminSection((admin) => {
    const uniqueName = "CapTestItem_" + botId;
    const created = admin.call("admin_shop_item_create", {
        name: uniqueName,
        slot: "utility",
        cost: "1",
        available: "true"
    });
    admin.assert(created && created.id, "Admin item creation must return an ID");
    itemId = created.id;
    admin.log(`[Bot-${agentIndex}] Created cap-test item ${itemId} (cost=1 CR).`);
});

// 2. Player setup (1000 starting credits per seeded default).
upsilon.bootstrapBot(accountName, password);

// 3. Buy exactly 99 units in one purchase -- lands precisely on the cap
//    boundary (also the max quantity a single request may carry per
//    shop.go's validatePurchase) and must succeed in full, no truncation.
const atCap = upsilon.call("shop_purchase", { shop_item_id: itemId, quantity: 99 });
upsilon.assertEquals(atCap.inventory_item.quantity, 99, "Boundary purchase should land exactly on the 99 cap");
upsilon.log(`[Bot-${agentIndex}] Bought 99 units, quantity=${atCap.inventory_item.quantity}, credits left=${atCap.credits}.`);

// 4. One more unit pushes owned quantity to 100 -- must be rejected with the
//    exact quantity_cap rejection.
try {
    upsilon.call("shop_purchase", { shop_item_id: itemId, quantity: 1 });
    upsilon.assert(false, "ERROR: Purchase pushing quantity to 100 was accepted!");
} catch (e) {
    upsilon.assertResponse(e, 422, "Inventory quantity cap reached (100 > 99).");
    upsilon.assertEquals(e.meta && e.meta.reason, "quantity_cap", "Wrong rejection reason");
    upsilon.log(`[Bot-${agentIndex}] EC-55: 100th unit properly rejected (quantity_cap).`);
}

// 5. Confirm the rejection didn't mutate state: quantity is still exactly 99.
const inventory = upsilon.call("profile_inventory", {});
const row = inventory.find(i => i.shop_item.id === itemId);
upsilon.assert(row != null, "Cap-tested item must still be in inventory");
upsilon.assertEquals(row.quantity, 99, "Rejected purchase must not have mutated inventory quantity");

// Cleanup: drop the throwaway admin item. The player account is deleted
// automatically by bootstrapBot's teardown hook after this script returns.
upsilon.adminSection((admin) => {
    admin.call("admin_shop_item_delete", { id: itemId });
    admin.log(`[Bot-${agentIndex}] Cap-test item deleted.`);
});

upsilon.log(`[Bot-${agentIndex}] EC-55: QUANTITY CAP (99) PASSED.`);
