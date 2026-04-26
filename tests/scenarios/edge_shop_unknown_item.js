// upsiloncli/tests/scenarios/edge_shop_unknown_item.js
// @test-link [[api_shop_purchase]]
//
// Validates that purchasing a non-existent item ID is rejected.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "ghost_shopper_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-50: Shop Purchase Unknown Item`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const ghostId = "00000000-0000-0000-0000-000000000000";

// 2. Attempt purchase
try {
    upsilon.call("shop_purchase", { shop_item_id: ghostId });
    upsilon.assert(false, "ERROR: Purchase of ghost item was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Purchase properly rejected: ${e.message}`);
    upsilon.assert(e.message.includes("404"), "Error must be 404 Not Found");
}

upsilon.log(`[Bot-${agentIndex}] EC-50: SHOP PURCHASE UNKNOWN ITEM PASSED.`);
