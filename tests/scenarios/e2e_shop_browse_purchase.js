// upsiloncli/tests/scenarios/e2e_shop_browse_purchase.js
// @test-link [[api_shop_browse]]
// @test-link [[api_shop_purchase]]
// @test-link [[entity_shop_item]]
// @test-link [[entity_player_inventory]]
//
// Validates shop catalog browsing and item purchase:
// 1. Browse shop to find "Basic Armor" (cost 200)
// 2. Purchase item
// 3. Verify credits decremented (1000 -> 800)
// 4. Verify inventory contains the item

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "shopper_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting CR-22: Shop Browse & Purchase`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);

// 2. Browse Shop
const items = upsilon.call("shop_browse", {});
upsilon.assert(items && items.length > 0, "Shop catalog must not be empty");

const basicArmor = items.find(i => i.name === "Basic Armor");
upsilon.assert(basicArmor, "Basic Armor must be available in shop");
upsilon.assertEquals(basicArmor.cost, 200, "Basic Armor should cost 200 CR");

// 3. Purchase
const purchaseResult = upsilon.call("shop_purchase", { shop_item_id: basicArmor.id });
upsilon.assert(purchaseResult && purchaseResult.credits !== undefined, "Purchase result must return remaining credits");
upsilon.assertEquals(purchaseResult.credits, 800, "Credits must be 800 after buying 200 CR item");

// 4. Verify Inventory
const inventory = upsilon.call("profile_inventory", {});
upsilon.assert(inventory && inventory.length > 0, "Inventory must contain purchased item");
const ownedArmor = inventory.find(i => i.shop_item_id === basicArmor.id);
upsilon.assert(ownedArmor, "Purchased item must exist in inventory");
upsilon.assertEquals(ownedArmor.quantity, 1, "Inventory quantity should be 1");

upsilon.log(`[Bot-${agentIndex}] CR-22: SHOP BROWSE & PURCHASE PASSED.`);
