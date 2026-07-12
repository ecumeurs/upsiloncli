// upsiloncli/tests/scenarios/edge_shop_insufficient_credits.js
// @test-link [[upsilonapi:api_shop_purchase]]
//
// Validates that purchasing more credits' worth of an item than the
// player's balance covers is rejected with 422 insufficient_credits.
//
// Deterministic boundary: a fresh account always starts with exactly 1000
// credits (schema default, see upsilonhub/internal/seed/seed.go:285) and
// Basic Armor is a fixed-price V2.0 catalog entry (200 credits, per
// [[upsilonapi:mechanic_shop_inventory_system]]). Buying 6 in a single call
// (1200 credits) exceeds the 1000-credit balance on the very first purchase
// attempt — no need to spend down to zero first.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "broke_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-49: Shop Purchase Insufficient Credits`);

// 1. Setup — fresh account, 1000 starting credits.
upsilon.bootstrapBot(accountName, password);
const items = upsilon.call("shop_browse", {});
const armor = items.find(i => i.name === "Basic Armor");
upsilon.assert(armor, "Basic Armor not found in shop catalog — seed data may have changed");
upsilon.assert(armor.cost === 200, `Expected Basic Armor to cost 200, got ${armor.cost}`);

// 2. Attempt to buy 6 (1200 credits) with only 1000 available — over budget
// on the first and only purchase attempt.
try {
    upsilon.call("shop_purchase", { shop_item_id: armor.id, quantity: 6 });
    upsilon.assert(false, "ERROR: Purchase exceeding credit balance was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] Purchase properly rejected: ${e.message} (Status: ${e.status})`);
    upsilon.assertResponse(e, 422, "Insufficient credits (1000 < 1200).");
    upsilon.assertEquals(e.meta.reason, "insufficient_credits", "Expected meta.reason to be insufficient_credits");
}

upsilon.log(`[Bot-${agentIndex}] EC-49: SHOP PURCHASE INSUFFICIENT CREDITS PASSED.`);
