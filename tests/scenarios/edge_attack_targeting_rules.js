// upsiloncli/tests/scenarios/edge_attack_targeting_rules.js
// @test-link [[mech_skill_validation_entity_targeting_rules_verification]]
// @test-link [[rule_friendly_fire]]
// @test-link [[entity_character]]

const agentCount = 4;
const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "targeting_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-19: Attack Entity Targeting Rules`);

// 1. Setup (2v2 for ally visibility)
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("2v2_PVP");
upsilon.syncGroup("targeting_ready", agentCount);

// 2. On our turn, attempt an attack on an ally (must fail with rule.friendly_fire).
// Then attempt an attack on an enemy (may or may not succeed depending on reach).
let allyRejection = false;
let rounds = 0;
while (!allyRejection && rounds < 60) {
    rounds++;
    const board = upsilon.waitNextTurn();
    if (!board) break;

    const me = upsilon.currentCharacter();
    const allies = upsilon.myAlliesCharacters().filter(a => a.hp > 0);
    const foes = upsilon.myFoesCharacters().filter(f => f.hp > 0);
    if (allies.length === 0) {
        upsilon.autoBattleTurn(matchData.match_id);
        continue;
    }
    const ally = allies[0];
    const adjacent = (Math.abs(me.position.x - ally.position.x) + Math.abs(me.position.y - ally.position.y)) <= 1;

    if (adjacent) {
        try {
            upsilon.call("game_action", {
                id: matchData.match_id,
                type: "attack",
                entity_id: me.id,
                target_coords: [ally.position]
            });
            upsilon.assert(false, "ERROR: Attack on ally accepted");
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] ✅ Ally attack rejected: ${e.message} (key=${e.error_key})`);
            upsilon.assertEquals(e.error_key, "rule.friendly_fire", "Expected rule.friendly_fire");
            allyRejection = true;
        }
    } else {
        upsilon.autoBattleTurn(matchData.match_id, ally);
    }
}

upsilon.assert(allyRejection, "Never reached an ally to confirm friendly-fire rejection");
upsilon.log(`[Bot-${agentIndex}] EC-19: ATTACK TARGETING RULES PASSED.`);
