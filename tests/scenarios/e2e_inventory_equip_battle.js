// upsiloncli/tests/scenarios/e2e_inventory_equip_battle.js
// @test-link [[api_character_equip]]
// @test-link [[mech_item_buff_application]]
// @test-link [[entity_character_equipment]]
//
// Validates end-to-end item utility:
// 1. Buy Armor and Sword
// 2. Equip them to a character
// 3. Start a battle
// 4. Verify engine entity has the buffs corresponding to the items

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "equipped_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting CR-23: Inventory Equip & Battle Buffs`);

// 1. Setup & Acquisition
upsilon.bootstrapBot(accountName, password);
const shopItems = upsilon.call("shop_browse", {});
const armor = shopItems.find(i => i.slot === "armor");
const weapon = shopItems.find(i => i.slot === "weapon");

upsilon.assert(armor && weapon, "Armor and Weapon must be available in shop");

upsilon.call("shop_purchase", { shop_item_id: armor.id });
upsilon.call("shop_purchase", { shop_item_id: weapon.id });

// 2. Equip
const profile = upsilon.call("profile_get", {});
upsilon.assert(profile.characters && profile.characters.length > 0, "Bot must have at least one character");
const charId = profile.characters[0].id;

const inv = upsilon.call("profile_inventory", {});
const invArmor = inv.find(i => i.shop_item_id === armor.id);
const invWeapon = inv.find(i => i.shop_item_id === weapon.id);

upsilon.call("character_equip", { character_id: charId, item_id: invArmor.id });
upsilon.call("character_equip", { character_id: charId, item_id: invWeapon.id });

// 3. Battle
// We only need to join and check the initial state.
upsilon.joinWaitMatch("1v1_PVP");

const board = upsilon.waitNextTurn();
const me = upsilon.currentCharacter();

// 4. Verify Buffs
// In Phase 4 engine integration, equipped items are projected as Forever=true buffs.
// We check if our entity has buffs from both item origins.
// NOTE: properties.Armor and properties.Attack should also be boosted.
upsilon.log(`[Bot-${agentIndex}] Checking buffs for entity ${me.id}`);
upsilon.assert(me.buffs && me.buffs.length >= 2, "Entity should have at least 2 buffs from equipment");

const armorBuff = me.buffs.find(b => b.origin_id === invArmor.id);
const weaponBuff = me.buffs.find(b => b.origin_id === invWeapon.id);

upsilon.assert(armorBuff, "Missing armor buff in engine entity");
upsilon.assert(weaponBuff, "Missing weapon buff in engine entity");
upsilon.assert(armorBuff.forever, "Armor buff must be permanent (Forever=true)");

upsilon.log(`[Bot-${agentIndex}] CR-23: INVENTORY EQUIP & BATTLE BUFFS PASSED.`);
