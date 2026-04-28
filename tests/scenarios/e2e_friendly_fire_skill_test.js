// upsiloncli/tests/scenarios/e2e_friendly_fire_skill_test.js
// @test-link [[rule_friendly_fire]]
// @test-link [[mech_skill_validation_entity_targeting_rules_verification]]

const botId = Math.floor(Math.random() * 100000);
const accountName = "ff_skill_bot_" + botId;
const password = "VeryLongBotPassword123!";
const gameMode = "1v1_PVE";

let fireballRejected = false;
let amuletItemId;

// 1. Admin Setup - Create Skill and Item
upsilon.adminSection(() => {
    upsilon.log("--- Admin Setup ---");

    const fireballTemplate = upsilon.call("admin_skill_template_create", {
        name: "Fireball",
        behavior: "Direct",
        grade: "I",
        targeting: { 
            TargetType: "EnemyOnly", 
            Range: 3, 
            MaxRange: 3, 
            MinRange: 0 
        }, 
        costs: { MP: 3 },
        effect: { Type: "Damage", Value: 10 },
        weight_positive: 10,
        weight_negative: 0,
        available: true
    });
    upsilon.assert(fireballTemplate && fireballTemplate.id, "Fireball template must be created");

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
const charIds = profile.characters.map(c => c.id);
const pyromancerId = charIds[0];
const allyId = charIds[1];
const thirdId = charIds[2];

upsilon.call("shop_purchase", { shop_item_id: amuletItemId });
const inventory = upsilon.call("profile_inventory", {});
const amuletInv = inventory.find(i => i.name === "Amulet of Fire" || (i.shop_item && i.shop_item.name === "Amulet of Fire"));
upsilon.call("character_equip", { characterId: pyromancerId, item_id: amuletInv.id });

// 3. Join Match
upsilon.log("--- Joining Match ---");
const matchData = upsilon.joinWaitMatch(gameMode);
const matchId = matchData.match_id;

// 4. Battle Loop
upsilon.log("--- Entering Battle ---");
let rounds = 0;
while (rounds < 100 && !fireballRejected) {
    rounds++;
    const board = upsilon.waitNextTurn();
    if (!board) break;

    const me = upsilon.currentCharacter();
    if (!me || !me.is_self) continue;

    let targetId;
    if (me.id === pyromancerId) targetId = allyId;
    else if (me.id === allyId) targetId = pyromancerId;
    else targetId = pyromancerId;

    const ally = upsilon.myCharacters().find(e => e.id === targetId && !e.dead);
    if (!ally) {
        upsilon.call("game_action", { id: matchId, entity_id: me.id, type: "pass" });
        continue;
    }

    if (me.id === pyromancerId) {
        const dist = Math.abs(me.position.x - ally.position.x) + Math.abs(me.position.y - ally.position.y);
        const fireball = me.equipped_skills.find(s => s.name === "Fireball");

        // We want to be very close (dist 1) to ensure we are testing Type, not Range
        if (fireball && dist <= 1) {
            upsilon.log(`Pyromancer attempting to cast Fireball on ally ${ally.name} at dist ${dist}`);
            try {
                upsilon.call("game_action", {
                    id: matchId,
                    entity_id: me.id,
                    type: "skill",
                    skill_id: fireball.skill_id,
                    target_coords: [ally.position]
                });
                upsilon.assert(false, "ERROR: Fireball on ally accepted (should be rejected by EnemyOnly)");
            } catch (e) {
                upsilon.log(`✅ Fireball rejected: ${e.message} (key=${e.error_key})`);
                // If it's still skill.target.range, then the Range property didn't take.
                // But if it's skill.target.none, we win.
                upsilon.assertEquals(e.error_key, "skill.target.none", "Expected skill.target.none for ally target");
                fireballRejected = true;
                continue;
            }
        } else if (fireball) {
            const path = upsilon.planTravelToward(me.id, ally.position, board);
            if (path && path.length > 0) {
                upsilon.log(`Moving to get closer to target (dist=${dist})...`);
                upsilon.call("game_action", { id: matchId, type: "move", entity_id: me.id, target_coords: path });
                continue;
            }
        }
    } else {
        // Ally moves toward pyromancer to help close the distance
        const path = upsilon.planTravelToward(me.id, ally.position, board);
        if (path && path.length > 0) {
            upsilon.call("game_action", { id: matchId, type: "move", entity_id: me.id, target_coords: path });
            continue;
        }
    }

    upsilon.call("game_action", { id: matchId, entity_id: me.id, type: "pass" });
}

upsilon.assert(fireballRejected, "Success criteria failed: Fireball friendly-fire was never rejected within 100 rounds");
upsilon.log("E2E FRIENDLY FIRE SKILL TEST PASSED.");
