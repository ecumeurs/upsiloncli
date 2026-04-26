// upsiloncli/tests/scenarios/edge_shop_insufficient_credits.js
// @test-link [[api_shop_purchase]]
// @test-link [[rule_credit_spending_shop]]
//
// Validates that purchasing an item with insufficient credits is rejected.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "broke_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-49: Shop Purchase Insufficient Credits`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const items = upsilon.call("shop_browse", {});
const expensiveItem = items.find(i => i.cost > 0); // Any item costs something

// 2. Spend credits until we can't afford it
// Our starter is 1000. Buy something expensive or just assume we have 1000.
// Let's buy 5 Basic Armors (5 * 200 = 1000).
const armor = items.find(i => i.name === "Basic Armor");
for (let i = 0; i < 5; i++) {
    upsilon.call("shop_purchase", { shop_item_id: armor.id });
}

// 3. Attempt to buy one more
const profile = upsilon.call("profile_get", {});
upsilon.log(`[Bot-${agentIndex}] Current credits: ${profile.credits}`);

try {
    upsilon.call("shop_purchase", { shop_item_id: armor.id });
    upsilon.assert(false, "ERROR: Purchase with 0 credits was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Purchase properly rejected: ${e.message}`);
    upsilon.assert(e.message.includes("422") || e.message.toLowerCase().includes("insufficient"), "Error must be 422/Insufficient Credits");
}

upsilon.log(`[Bot-${agentIndex}] EC-49: SHOP PURCHASE INSUFFICIENT CREDITS PASSED.`);
