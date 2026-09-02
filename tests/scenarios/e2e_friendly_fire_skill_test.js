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
upsilon.adminSection((admin) => {
    admin.log("--- Admin Setup ---");

    const fireballTemplate = admin.call("admin_skill_template_create", {
        name: "Fireball",
        behavior: "Direct",
        grade: "I",
        targeting: { 
            TargetType: "EnemyOnly", 
            Range: { value: 0, max: 10 }
        }, 
        costs: { MPLeech: 3 },
        effect: { DamageScale: 150 },
        weight_positive: 10,
        weight_negative: 0,
        available: true
    });
    admin.assert(fireballTemplate && fireballTemplate.id, "Fireball template must be created");

    const amuletItem = admin.call("admin_shop_item_create", {
        name: "Amulet of Fire",
        slot: "utility",
        cost: 100,
        available: true,
        skill_template_id: fireballTemplate.id,
        properties_json: JSON.stringify({})
    });
    admin.assert(amuletItem && amuletItem.id, "Amulet item must be created");
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

// 3. Join Match and Battle Loop
upsilon.log("--- Starting Match Attempts ---");

const MAX_ROUNDS = 100;
const MAX_MATCHES = 3;

for (let matchAttempt = 1; matchAttempt <= MAX_MATCHES && !fireballRejected; matchAttempt++) {
    if (matchAttempt > 1) {
        upsilon.log(`Cleaning up session before retry...`);
        try { upsilon.call("matchmaking_leave", {}); } catch (e) {}
        upsilon.sleep(2000);
    }

    upsilon.log(`Match Attempt ${matchAttempt}/${MAX_MATCHES}...`);
    let matchData;
    try {
        matchData = upsilon.joinWaitMatch(gameMode);
    } catch (e) {
        upsilon.log(`Failed to join match: ${e.message}. Retrying...`);
        matchAttempt--; // Don't count this attempt
        upsilon.sleep(3000);
        continue;
    }
    const matchId = matchData.match_id;

    let rounds = 0;
    while (rounds < MAX_ROUNDS && !fireballRejected) {
        rounds++;
        const board = upsilon.waitNextTurn();
        if (!board || board.game_finished) {
            upsilon.log(`Match ${matchId} ended (finished=${!!board?.game_finished}).`);
            break;
        }

        const me = upsilon.currentCharacter();
        if (!me || !me.is_self) continue;

        // Find nearest living ally
        const allies = upsilon.myCharacters().filter(e => e.id !== me.id && !e.dead);
        if (allies.length === 0) {
            upsilon.log(`No living allies found on turn ${rounds}. Passing.`);
            upsilon.call("game_action", { id: matchId, type: "pass", entity_id: me.id });
            continue;
        }

        allies.sort((a, b) => upsilon.distance2D(me.position, a.position) - upsilon.distance2D(me.position, b.position));
        const ally = allies[0];
        const dist = upsilon.distance2D(me.position, ally.position);

        // Check if I am the "Pyromancer" (the one with Fireball)
        const fireball = me.equipped_skills.find(s => s.name === "Fireball");

        if (fireball) {
            // Increased range to 10 to solve the "moving problem" under fire
            if (dist <= 10) {
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
                    // Note: skill.target.none is expected for EnemyOnly targeting violations
                    upsilon.assertEquals(e.error_key, "skill.target.none", "Expected skill.target.none for ally target");
                    fireballRejected = true;
                    break; // Exit rounds loop
                }
            } else {
                const path = upsilon.planTravelToward(me.id, ally.position, board);
                if (path && path.length > 0) {
                    upsilon.log(`Pyromancer moving toward ${ally.name} (dist=${dist})...`);
                    upsilon.call("game_action", { id: matchId, type: "move", entity_id: me.id, target_coords: path });
                    continue;
                }
            }
        } else {
            // Non-pyromancer ally moves toward pyromancer to help close the distance
            const path = upsilon.planTravelToward(me.id, ally.position, board);
            if (path && path.length > 0) {
                upsilon.log(`Ally ${me.name} moving toward Pyromancer ${ally.name} to help meet (dist=${dist})...`);
                upsilon.call("game_action", { id: matchId, type: "move", entity_id: me.id, target_coords: path });
                continue;
            }
        }

        upsilon.call("game_action", { id: matchId, entity_id: me.id, type: "pass" });
    }
}

upsilon.assert(fireballRejected, "Success criteria failed: Fireball friendly-fire was never rejected within 3 matches");
upsilon.log("E2E FRIENDLY FIRE SKILL TEST PASSED.");
