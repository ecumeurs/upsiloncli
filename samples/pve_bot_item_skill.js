// Upsilon Bot: 1v1 PVE Battle with Items and Skills
// This bot purchases a weapon and an exotic item granting a fireball skill.
// It then uses both in a PVE battle.

const botId = Math.floor(Math.random() * 100000);
const accountName = "bot_exotic_" + botId;
const password = "VeryLongBotPassword123!";
const gameMode = "1v1_PVE";

// 1. Admin Setup - Create Skill and Items
// @spec-link [[mech_script_admin_section]]
let swordItemId, amuletItemId;

upsilon.adminSection(() => {
    upsilon.log("--- Admin Setup ---");

    // Create Fireball Skill
    const fireballTemplate = upsilon.call("admin_skill_template_create", {
        name: "Fireball",
        behavior: "Direct",
        grade: "I",
        targeting: { Type: "Single", Range: 3 },
        costs: { MP: 3 },
        effect: { Type: "Damage", Value: 10 },
        weight_positive: 10,
        weight_negative: 0,
        available: true
    });
    upsilon.assert(fireballTemplate && fireballTemplate.id, "Fireball template must be created");
    upsilon.log(`Skill template created: ${fireballTemplate.id}`);

    // Create Steel Sword (Weapon)
    const swordItem = upsilon.call("admin_shop_item_create", {
        name: "Steel Sword",
        slot: "weapon",
        cost: 50,
        available: true,
        properties: { WeaponBaseDamage: 30 }
    });
    upsilon.assert(swordItem && swordItem.id, "Sword item must be created");
    upsilon.log(`Sword item created: ${swordItem.id}`);
    swordItemId = swordItem.id;

    // Create Amulet of Fire (Exotic Skill Granting Item)
    const amuletItem = upsilon.call("admin_shop_item_create", {
        name: "Amulet of Fire",
        slot: "utility",
        cost: 100,
        available: true,
        skill_template_id: fireballTemplate.id,
        properties_json: JSON.stringify({})
    });
    upsilon.assert(amuletItem && amuletItem.id, "Amulet item must be created");
    upsilon.log(`Amulet item created: ${amuletItem.id}`);
    amuletItemId = amuletItem.id;
});

// 2. Bot Setup
upsilon.log("--- Bot Setup ---");
upsilon.bootstrapBot(accountName, password);

const profile = upsilon.call("profile_get", {});
const charId = profile.characters[0].id;

// Purchase items
upsilon.call("shop_purchase", { shop_item_id: swordItemId });
upsilon.call("shop_purchase", { shop_item_id: amuletItemId });
upsilon.log("Items purchased.");

// Equip items
const inventory = upsilon.call("profile_inventory", {});
const swordInv = inventory.find(i => i.name === "Steel Sword" || i.shop_item.name === "Steel Sword");
const amuletInv = inventory.find(i => i.name === "Amulet of Fire" || i.shop_item.name === "Amulet of Fire");

upsilon.call("character_equip", { characterId: charId, item_id: swordInv.id });
upsilon.call("character_equip", { characterId: charId, item_id: amuletInv.id });
upsilon.log("Items equipped.");

// 3. Join Match
upsilon.log("--- Joining Match ---");
const matchData = upsilon.joinWaitMatch(gameMode);
const matchId = matchData.match_id;
upsilon.log("Joined match: " + matchId);

// 4. Battle Loop
upsilon.log("--- Entering Battle ---");
while (true) {
    const board = upsilon.waitNextTurn();
    if (!board) break; // Game ended

    executeTacticalLogic(board, matchId);
}

function executeTacticalLogic(board, matchId) {
    const actingEntity = upsilon.currentCharacter();
    if (!actingEntity || !actingEntity.is_self) return;

    upsilon.log(`[Unit: ${actingEntity.name} | HP: ${actingEntity.hp}/${actingEntity.max_hp}]`);

    const enemies = upsilon.myFoesCharacters().filter(e => !e.dead && e.hp > 0);
    if (enemies.length === 0) {
        upsilon.call("game_action", { id: matchId, entity_id: actingEntity.id, type: "pass" });
        return;
    }

    // Find nearest enemy using 2D Chebyshev distance (allows diagonals)
    let nearestEnemy = enemies.reduce((prev, curr) => {
        const dist = (e) => Math.max(Math.abs(actingEntity.position.x - e.position.x), Math.abs(actingEntity.position.y - e.position.y));
        return dist(curr) < dist(prev) ? curr : prev;
    });

    const distManhattan = upsilon.distance2D(actingEntity.position, nearestEnemy.position);
    const zDiff = upsilon.activeHeightDifference(nearestEnemy.position, board);

    // 1. Attack if adjacent (Manhattan <= 1) - Prefer Sword to see it in action
    // Match engine attack logic: 2D Manhattan + height check
    if (distManhattan <= 1 && zDiff <= 2 && !actingEntity.has_attacked) {
        upsilon.log("Slashing " + nearestEnemy.name + " with Steel Sword!");
        try {
            upsilon.call("game_action", {
                id: matchId,
                entity_id: actingEntity.id,
                type: "attack",
                target_coords: [nearestEnemy.position]
            });
            return;
        } catch (e) {
            upsilon.log("Attack failed: " + (e.message || "Unknown error"));
        }
    }

    // 2. Use Fireball if in range (3) and has skill
    const fireball = actingEntity.equipped_skills.find(s => s.name === "Fireball");
    if (fireball && distManhattan <= 3 && !actingEntity.has_attacked) {
        upsilon.log("Casting Fireball on " + nearestEnemy.name);
        try {
            upsilon.call("game_action", {
                id: matchId,
                entity_id: actingEntity.id,
                type: "skill",
                skill_id: fireball.skill_id,
                target_coords: [nearestEnemy.position]
            });
            return;
        } catch (e) {
            upsilon.log("Skill failed: " + (e.message || "Unknown error"));
            // If it failed (e.g. cooldown), we might still want to move or try something else
        }
    }

    // 3. Move toward enemy
    if (distManhattan > 1 && actingEntity.move > 0 && !actingEntity.has_attacked) {
        const pathSteps = upsilon.planTravelToward(actingEntity.id, nearestEnemy.position, board);
        if (pathSteps && pathSteps.length > 0) {
            upsilon.log("Moving toward " + nearestEnemy.name);
            upsilon.call("game_action", {
                id: matchId,
                entity_id: actingEntity.id,
                type: "move",
                target_coords: pathSteps
            });
            return;
        }
    }

    // 4. Pass
    upsilon.log("Passing turn.");
    upsilon.call("game_action", { id: matchId, entity_id: actingEntity.id, type: "pass" });
}

upsilon.log("Agent lifecycle complete.");
