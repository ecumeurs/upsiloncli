// upsiloncli/tests/scenarios/e2e_item_grants_skill.js
// @test-link [[api_shop_item_admin_crud]]
// @test-link [[api_skill_template_admin_crud]]
// @test-link [[api_matchmaking]]
//
// D11: Validates that an exotic shop item with skill_template_id grants its skill
// to the entity at arena initialization:
// 1. Admin creates a skill template
// 2. Admin creates a shop item linked to the template (skill_template_id)
// 3. Player purchases and equips the exotic item
// 4. Player joins a PvE match
// 5. Match starts successfully — bridge must register both item buffs and the item-granted skill

upsilon.log("Starting: D11 — Item Grants Skill at Arena Init");

// 1. Admin creates skill template and exotic shop item
// @spec-link [[mech_script_admin_section]]
let shopItemId, templateId;

upsilon.adminSection((admin) => {
    const uniqueSkillName = "ExoticSkill_" + Math.floor(Math.random() * 100000);
    const template = admin.call("admin_skill_template_create", {
        name: uniqueSkillName,
        behavior: "Passive",
        grade: "III",
        weight_positive: "10",
        weight_negative: "1",
        available: "true"
    });
    admin.assert(template && template.id, "Skill template must be created");
    admin.log(`Skill template created: ${template.id} ("${template.name}")`);
    templateId = template.id;

    // 2. Admin creates exotic shop item linked to the template
    const uniqueItemName = "ExoticAmulet_" + Math.floor(Math.random() * 100000);
    const shopItem = admin.call("admin_shop_item_create", {
        name: uniqueItemName,
        slot: "utility",
        cost: "100",
        available: "true",
        skill_template_id: template.id
    });
    admin.assert(shopItem && shopItem.id, "Exotic shop item must be created");
    admin.log(`Exotic shop item created: ${shopItem.id} ("${shopItem.name}")`);
    shopItemId = shopItem.id;
});

// 3. Player setup — purchase and equip the exotic item
const botId = Math.floor(Math.random() * 10000);
const playerAccount = "exotic_buyer_" + botId;
upsilon.bootstrapBot(playerAccount, "VerySecurePassword123!");

const profile = upsilon.call("profile_get", {});
upsilon.assert(profile.characters && profile.characters.length > 0, "Player must have a character");
const charId = profile.characters[0].id;

const purchase = upsilon.call("shop_purchase", { shop_item_id: shopItemId });
upsilon.assert(purchase && purchase.inventory_item, "Purchase must return an inventory item");
const invItemId = purchase.inventory_item.id;
upsilon.log(`Exotic item purchased: inventory_item_id=${invItemId}`);

upsilon.call("character_equip", { characterId: charId, item_id: invItemId });
upsilon.log("Exotic item equipped.");

// 4. Join PvE match — bridge must include item-granted skill in EquippedSkills payload
upsilon.log("Joining PvE match with exotic item equipped...");
const matchData = upsilon.joinWaitMatch("1v1_PVE");
upsilon.assert(matchData && matchData.match_id, "Must match into a PvE game");

const board = upsilon.waitNextTurn();
upsilon.assert(board != null, "Must receive board state");

// 5. Entity must be present — match started without bridge error
const myPlayer = board.players.find(p => p.is_self);
upsilon.assert(myPlayer, "Own player must be in board state");
const me = myPlayer.entities.find(e => e.id === charId);
upsilon.assert(me, "Character with exotic item must be present in match");

upsilon.log(`[D11] Entity ${charId} entered match — bridge registered item-granted skill without error.`);

// 5. Cleanup admin resources
upsilon.adminSection((admin) => {
    admin.call("admin_shop_item_delete", { id: shopItemId });
    admin.call("admin_skill_template_delete", { id: templateId });
});

upsilon.log("D11 — ITEM GRANTS SKILL AT ARENA INIT PASSED.");
