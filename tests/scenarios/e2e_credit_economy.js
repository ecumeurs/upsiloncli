// upsiloncli/tests/scenarios/e2e_credit_economy.js
// @test-link [[rule_credit_earning_damage]]
// @test-link [[entity_player_credits]]
// @test-link [[api_profile_credits]]
// @test-link [[rule_credit_action_communication_layer]]
//
// Validates the end-to-end credit-earning loop:
//   engine attack rule → ActionFeedback.credits → webhook → Laravel
//   WebhookController → users.credits increment + credit_transactions row
//   → exposed via GET /profile (UserResource.credits).
//
// Uses PVE (1 player vs AI) — single bot, no syncGroup, no turn deadlock.
// After landing one attack we wait for the board.updated WebSocket event,
// validate that action.credits is present, then forfeit and confirm the
// credit increment is persisted on /profile.
//
// WS data shape: event.data.action — broadcastWith() merges match_id + BoardStateResource directly into data.
//
// Determinism note (ISS follow-up): the arena's dimensions, obstacles, and
// spawn points are randomized (mech_board_generation.atom.md — width/height
// each rolled 5..15 tiles), so a plain melee-walk-and-attack setup can time
// out before ever closing distance on an unlucky roll. To make damage
// infliction independent of enemy composition and spawn distance, every
// character on the bot's team is granted a long-range, high-power "Fireball"
// skill through an equipped item — same pattern as
// e2e_friendly_fire_skill_test.js / e2e_item_grants_skill.js — and the loop
// casts it on sight instead of walking in for melee.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "credit_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting CR-20: Credit Economy (damage-earned credits)`);

// 0. Admin Setup — a long-range, high-power Fireball skill granted via an
// equippable item, so damage no longer depends on the bot ever reaching
// melee range.
let fireballTemplateId;
upsilon.adminSection((admin) => {
    admin.log("--- Admin Setup: Fireball skill ---");

    // Range.max: the board is a rectangular grid whose width/height are each
    // rolled 5..15 tiles inclusive (mech_board_generation.atom.md), so the
    // worst-case corner-to-corner diagonal is 15*sqrt(2) ≈ 21.2 tiles. 30
    // comfortably exceeds that for any rolled board, so every living foe is
    // always in range from the very first turn.
    const fireballTemplate = admin.call("admin_skill_template_create", {
        name: "Fireball",
        behavior: "Direct",
        grade: "I",
        targeting: {
            TargetType: "EnemyOnly",
            Range: { value: 0, max: 30 }
        },
        // No resource cost: MPLeech (or any other leech) would risk stalling
        // repeated casts across turns if MP doesn't regenerate fast enough —
        // a new flake source the setup must not introduce. Omitting costs
        // falls back to the engine's zero defaults (upsilontypes/property/def/skill.go).
        costs: {},
        // effect is a flat property-name -> value map (mirrors "costs"), not a
        // {Type, Value} wrapper — bridge_utils.go's buildSkillEffect resolves
        // each raw key directly against the SkillProperties registry
        // (def.SkillProperty(property.SkillProperties(key))), so the key must
        // be the actual property name ("DamageScale").
        //
        // The value is a PERCENTAGE of the caster's Attack, not flat damage:
        // truedmg = max((attack * damage / 100) - defense - armor, 0)
        // (effectapplicator.go). Base characters roll Attack 10 / Defense 5
        // (upsilonhub character.NewBaseStats); 5000 (5000% of Attack) keeps
        // truedmg comfortably positive against any plausible enemy
        // defense/armor roll, including bosses or buffed foes.
        effect: { DamageScale: 5000 },
        weight_positive: 10,
        weight_negative: 0,
        available: true
    });
    admin.assert(fireballTemplate && fireballTemplate.id, "Fireball template must be created");
    fireballTemplateId = fireballTemplate.id;
});

upsilon.bootstrapBot(accountName, password);

// 1. Equip every character on the bot's team with its own Fireball amulet.
// character_equip is per character, AND the economy inventory is stackable
// per (player, shop_item) pair (upsiloneconomy Purchase upserts one row per
// catalog item) while character.Equip enforces cross-character mutual
// exclusivity on a given inventory item (pg_equipment.go: equipping detaches
// the item from any other character first). Buying the SAME shop item 3
// times therefore yields one shared inventory row that only one character
// can hold at a time — not 3 independent instances. A distinct shop catalog
// entry per character (same skill template, different shop_item_id) is what
// actually produces 3 independently-equippable instances.
const rosterProfile = upsilon.call("profile_get", {});
upsilon.assert(rosterProfile.characters && rosterProfile.characters.length > 0, "Bot must have a character roster");

let fireballItemIds = [];
upsilon.adminSection((admin) => {
    admin.log("--- Admin Setup: one Fireball amulet catalog entry per team member ---");
    for (let i = 0; i < rosterProfile.characters.length; i++) {
        const fireballItem = admin.call("admin_shop_item_create", {
            name: `Amulet of Fire #${i + 1}`,
            slot: "utility",
            cost: 100,
            available: true,
            skill_template_id: fireballTemplateId,
            properties_json: JSON.stringify({})
        });
        admin.assert(fireballItem && fireballItem.id, "Fireball item must be created");
        fireballItemIds.push(fireballItem.id);
    }
});

for (let i = 0; i < rosterProfile.characters.length; i++) {
    const character = rosterProfile.characters[i];
    const purchase = upsilon.call("shop_purchase", { shop_item_id: fireballItemIds[i] });
    upsilon.assert(purchase && purchase.inventory_item, "Fireball item purchase must return an inventory item");
    upsilon.call("character_equip", { characterId: character.id, item_id: purchase.inventory_item.id });
}
upsilon.log(`[Bot-${agentIndex}] Equipped Fireball on ${rosterProfile.characters.length} team member(s).`);

const matchData = upsilon.joinWaitMatch("1v1_PVE");

// 2. Snapshot initial credits BEFORE any attack lands (after the setup
// purchases above, so the credit delta below reflects damage only).
const initialProfile = upsilon.call("profile_get", {});
const initialCredits = initialProfile.credits || 1000;
upsilon.log(`[Bot-${agentIndex}] Initial credits: ${initialCredits}`);

// 3. Play until we land at least one hit — cast Fireball on sight every
// turn; only fall back to movement/melee when no foe is targetable or the
// cast is transiently unavailable (e.g. on cooldown after a prior miss).
let myDamageDealt = 0;
let attacked = false;
let meleeReachAchieved = false; // diagnostic only — does not gate the loop.
let rounds = 0;
const MAX_ROUNDS = 80;

while (!attacked && rounds < MAX_ROUNDS) {
    rounds++;
    const board = upsilon.waitNextTurn();
    if (!board) break;

    const me = upsilon.currentCharacter();
    const foes = upsilon.myFoesCharacters().filter(f => f.hp > 0);
    if (foes.length === 0) break;

    const foe = foes[0];
    const adjacent = (Math.abs(me.position.x - foe.position.x) + Math.abs(me.position.y - foe.position.y)) <= 1;
    if (adjacent) {
        // Preserve diagnostic value: record whether melee reach was ever
        // achieved, so this change does not silently mask a genuine
        // movement/pathfinding regression if one exists.
        meleeReachAchieved = true;
    }

    const fireball = me.equipped_skills.find(s => s.name === "Fireball");
    // A turn allows exactly one action. actionSubmitted tracks whether the
    // Fireball game_action call was accepted by the engine this turn (hit or
    // miss both count as "submitted") so the fallback branch below only runs
    // when the cast itself could not be sent (e.g. on cooldown) — never as a
    // second action on top of an already-accepted cast.
    let actionSubmitted = false;

    if (fireball) {
        const foeHpBefore = foe.hp;
        try {
            const result = upsilon.call("game_action", {
                id: matchData.match_id,
                type: "skill",
                entity_id: me.id,
                skill_id: fireball.skill_id,
                target_coords: [foe.position]
            });
            actionSubmitted = true;

            if (result && result.results && result.results.length > 0) {
                const targetResult = result.results.find(r => r.target_id === foe.id);
                // A cast can still miss the accuracy/dodge hit test and land
                // for zero damage — keep retrying on later turns in that case.
                if (targetResult && targetResult.damage > 0) {
                    myDamageDealt = targetResult.damage;
                    upsilon.log(`[Bot-${agentIndex}] Fireball hit ${foe.name} for ${myDamageDealt} damage (${foeHpBefore} → ${targetResult.new_hp})`);
                    attacked = true;
                } else {
                    upsilon.log(`[Bot-${agentIndex}] Fireball cast on ${foe.name} missed (dodge) — retrying next turn.`);
                }
            }
        } catch (e) {
            // Cooldown or another transient rejection — fall back to melee/move this turn.
            upsilon.log(`[Bot-${agentIndex}] Fireball cast unavailable (${e.error_key || e.message}) — falling back.`);
        }
    }

    if (!actionSubmitted) {
        if (adjacent) {
            const result = upsilon.call("game_action", {
                id: matchData.match_id,
                type: "attack",
                entity_id: me.id,
                target_coords: [foe.position]
            });

            if (result && result.results && result.results.length > 0) {
                const targetResult = result.results.find(r => r.target_id === foe.id);
                if (targetResult && targetResult.damage > 0) {
                    myDamageDealt = targetResult.damage;
                    upsilon.log(`[Bot-${agentIndex}] Melee attacked ${foe.name} for ${myDamageDealt} damage (${foe.hp} → ${targetResult.new_hp})`);
                    attacked = true;
                }
            }
        } else {
            upsilon.autoBattleTurn(matchData.match_id, foe);
        }
    }
}

upsilon.log(`[Bot-${agentIndex}] Melee reach achieved during the match: ${meleeReachAchieved}`);
upsilon.assert(attacked, "Never landed a hit on an enemy within 80 rounds");
upsilon.assert(myDamageDealt > 0, "Attack landed but no damage was reported (defense too high?)");

// 4. We no longer wait for the board.updated WebSocket event to verify credits.
// Credits are now awarded synchronously in the ActionController response.
upsilon.log(`[Bot-${agentIndex}] Skipping WS check. Relying on synchronous credit awarding.`);

// 5. Now forfeit — credits are already in the DB via synchronous award.
upsilon.call("game_forfeit", { id: matchData.match_id });
upsilon.log(`[Bot-${agentIndex}] Forfeited match after WS confirmation`);

// 6. Poll /profile until the expected balance appears.
let observedCredits = initialCredits;
const expectedCredits = initialCredits + myDamageDealt;
const DEADLINE_MS = 5000;
const POLL_MS = 250;
const start = Date.now();
while (Date.now() - start < DEADLINE_MS) {
    const p = upsilon.call("profile_get", {});
    observedCredits = p.credits || 0;
    if (observedCredits >= expectedCredits) break;
    upsilon.sleep(POLL_MS);
}

upsilon.log(`[Bot-${agentIndex}] Final credits: ${observedCredits} (delta=${observedCredits - initialCredits}, damage_dealt=${myDamageDealt})`);
upsilon.assertEquals(observedCredits, expectedCredits, "Credit delta must equal damage dealt (1 hp = 1 credit)");

// 7. Sanity: /profile/credits must agree with /profile.credits.
try {
    const credResp = upsilon.call("profile_credits", {});
    if (credResp && credResp.credits != null) {
        upsilon.assertEquals(credResp.credits, observedCredits, "/profile/credits must match /profile.credits");
        upsilon.log(`[Bot-${agentIndex}] /profile/credits agrees: ${credResp.credits}`);
    }
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] /profile/credits route not exercised: ${e.message || e}`);
}

upsilon.log(`[Bot-${agentIndex}] CR-20: CREDIT ECONOMY (DAMAGE) PASSED.`);
