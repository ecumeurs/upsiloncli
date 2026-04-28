// Upsilon Bot: 1v1 PVE Battle with Unique Item Roles
// This bot manages 1 Player with 3 characters with distinct behaviors:
// 1. Pyromancer: Uses Fireball once, then passes forever.
// 2. Swordsman: Tracks and attacks with a Steel Sword.
// 3. Loner: Has nothing and always passes.

const botId = Math.floor(Math.random() * 100000);
const accountName = "bot_role_" + botId;
const password = "VeryLongBotPassword123!";
const gameMode = "1v1_PVE";

// Flags for success criteria
let fireballFired = false;
let swordAttacked = false;
let maxSwordDamage = 0;

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

    // Create Steel Sword (Weapon) - High damage to ensure assertion pass
    const swordItem = upsilon.call("admin_shop_item_create", {
        name: "Steel Sword",
        slot: "weapon",
        cost: 50,
        available: true,
        properties: { WeaponBaseDamage: 40 } // Reverted to WeaponBaseDamage per user request
    });
    upsilon.assert(swordItem && swordItem.id, "Sword item must be created");
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
    amuletItemId = amuletItem.id;
});

// 2. Bot Setup
upsilon.log("--- Bot Setup ---");
upsilon.bootstrapBot(accountName, password);

const profile = upsilon.call("profile_get", {});
upsilon.assert(profile.characters.length >= 3, "Bot should have 3 characters by default");

const charIds = profile.characters.map(c => c.id);
const swordsmanId = charIds[0];
const pyromancerId = charIds[1];
const lonerId = charIds[2];

// Purchase items
upsilon.call("shop_purchase", { shop_item_id: swordItemId });
upsilon.call("shop_purchase", { shop_item_id: amuletItemId });
upsilon.log("Items purchased.");

// Equip items uniquely
const inventory = upsilon.call("profile_inventory", {});
const swordInv = inventory.find(i => i.name === "Steel Sword" || (i.shop_item && i.shop_item.name === "Steel Sword"));
const amuletInv = inventory.find(i => i.name === "Amulet of Fire" || (i.shop_item && i.shop_item.name === "Amulet of Fire"));

upsilon.call("character_equip", { characterId: swordsmanId, item_id: swordInv.id });
upsilon.call("character_equip", { characterId: pyromancerId, item_id: amuletInv.id });
upsilon.log("Items equipped: Swordsman gets Sword, Pyromancer gets Amulet, Loner stays empty.");

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

// 5. Final Assertions
upsilon.log("--- Post-Match Assertions ---");
upsilon.assert(fireballFired, "Success criteria failed: Fireball was never fired");
upsilon.assert(swordAttacked, "Success criteria failed: Swordsman never attacked");
upsilon.assert(maxSwordDamage > 30, `Success criteria failed: Max sword damage was ${maxSwordDamage}, expected > 30`);

upsilon.log(`Final Report: Fireball Fired: ${fireballFired} | Sword Attack: ${swordAttacked} | Max Damage: ${maxSwordDamage}`);
upsilon.log("Agent lifecycle complete.");

function executeTacticalLogic(board, matchId) {
    const actingEntity = upsilon.currentCharacter();
    if (!actingEntity || !actingEntity.is_self) return;

    upsilon.log(`[Turn: ${actingEntity.name} | HP: ${actingEntity.hp}/${actingEntity.max_hp}]`);

    // 1. Loner Logic: Just pass
    if (actingEntity.id === lonerId) {
        upsilon.log("Loner has nothing to do. Passing.");
        upsilon.call("game_action", { id: matchId, entity_id: actingEntity.id, type: "pass" });
        return;
    }

    // 2. Pyromancer Logic: Fireball once then pass forever
    if (actingEntity.id === pyromancerId && fireballFired) {
        upsilon.log("Pyromancer has already fired his ball. Passing forever.");
        upsilon.call("game_action", { id: matchId, entity_id: actingEntity.id, type: "pass" });
        return;
    }

    const enemies = upsilon.myFoesCharacters().filter(e => !e.dead && e.hp > 0);
    if (enemies.length === 0) {
        upsilon.call("game_action", { id: matchId, entity_id: actingEntity.id, type: "pass" });
        return;
    }

    // Find nearest enemy using Manhattan distance (consistent with engine skill range)
    let nearestEnemy = enemies.reduce((prev, curr) => {
        const dist = (e) => upsilon.distance2D(actingEntity.position, e.position);
        return dist(curr) < dist(prev) ? curr : prev;
    });

    const distManhattan = upsilon.distance2D(actingEntity.position, nearestEnemy.position);

    // Pyromancer Specific Action
    if (actingEntity.id === pyromancerId) {
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
                fireballFired = true;
                return;
            } catch (e) {
                upsilon.log("Fireball failed: " + (e.message || "Unknown error"));
            }
        }
    }

    // Swordsman Specific Action
    if (actingEntity.id === swordsmanId) {
        const zDiff = upsilon.activeHeightDifference(nearestEnemy.position, board);
        if (distManhattan <= 1 && zDiff <= 2 && !actingEntity.has_attacked) {
            upsilon.log("Slashing " + nearestEnemy.name + " with Steel Sword!");
            try {
                const result = upsilon.call("game_action", {
                    id: matchId,
                    entity_id: actingEntity.id,
                    type: "attack",
                    target_coords: [nearestEnemy.position]
                });

                // Extract damage for assertion
                if (result && result.results && result.results.length > 0) {
                    const targetRes = result.results.find(r => r.target_id === nearestEnemy.id);
                    if (targetRes) {
                        const damage = targetRes.damage || 0;
                        swordAttacked = true;
                        maxSwordDamage = Math.max(maxSwordDamage, damage);
                        upsilon.log(`Sword impact! Dealt ${damage} damage.`);
                    }
                }
                return;
            } catch (e) {
                upsilon.log("Sword attack failed: " + (e.message || "Unknown error"));
            }
        }
    }

    // Generic Movement Toward Enemy (if not already adjacent/fired)
    if (actingEntity.move > 0 && !actingEntity.has_attacked) {
        const pathSteps = upsilon.planTravelToward(actingEntity.id, nearestEnemy.position, board);
        if (pathSteps && pathSteps.length > 0) {
            upsilon.log(`${actingEntity.name} moving toward ${nearestEnemy.name}`);
            upsilon.call("game_action", {
                id: matchId,
                entity_id: actingEntity.id,
                type: "move",
                target_coords: pathSteps
            });
            return;
        }
    }

    // Pass if no other action taken
    upsilon.log("Passing turn.");
    upsilon.call("game_action", { id: matchId, entity_id: actingEntity.id, type: "pass" });
}
