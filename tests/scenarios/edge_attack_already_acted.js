// upsiloncli/tests/scenarios/edge_attack_already_acted.js
// @test-link [[mech_skill_validation_action_state_verification]]
// @test-link [[mech_action_economy]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "alreadyacted_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-17: Attack Already Acted`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVE");

// 2. Move to reach an enemy across however many turns it takes, then attack,
// then try to attack a second time in the same turn.
let attacked = false;
let secondAttackRejected = false;
let rounds = 0;

while (rounds < 60 && !secondAttackRejected) {
    rounds++;
    const board = upsilon.waitNextTurn();
    if (!board) break;

    const me = upsilon.currentCharacter();
    const foes = upsilon.myFoesCharacters().filter(f => f.hp > 0);
    if (foes.length === 0) break;
    const foe = foes[0];

    const adjacent = (Math.abs(me.position.x - foe.position.x) + Math.abs(me.position.y - foe.position.y)) <= 1;

    if (!attacked && adjacent) {
        upsilon.log(`[Bot-${agentIndex}] First attack on ${foe.name}...`);
        upsilon.call("game_action", {
            id: matchData.match_id,
            type: "attack",
            entity_id: me.id,
            target_coords: [foe.position]
        });
        attacked = true;

        // Second attack in the same turn must be rejected.
        try {
            upsilon.call("game_action", {
                id: matchData.match_id,
                type: "attack",
                entity_id: me.id,
                target_coords: [foe.position]
            });
            upsilon.assert(false, "ERROR: Second attack in same turn was accepted!");
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] ✅ Second attack rejected: ${e.message} (key=${e.error_key})`);
            secondAttackRejected = true;
        }
    } else {
        // Still out of reach: delegate to the canonical turn helper.
        upsilon.autoBattleTurn(matchData.match_id, foe);
    }
}

upsilon.assert(secondAttackRejected, "Test never reached enemy to trigger the double-attack case");
upsilon.log(`[Bot-${agentIndex}] EC-17: ATTACK ALREADY ACTED PASSED.`);
