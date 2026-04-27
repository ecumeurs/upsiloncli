// upsiloncli/tests/scenarios/edge_attack_wrong_controller.js
// @test-link [[mech_skill_validation_turn_controller_identity_verification]]
// @test-link [[entity_player]]
//
// Two bots: bot 0 publishes its entity id; bot 1 tries to attack using bot 0's
// entity id (which bot 1 does not control) on its own turn.

const agentCount = 2;
const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "attackwc_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-11: Attack Wrong Controller`);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");

if (agentIndex === 0) {
    upsilon.setShared("match_id", matchData.match_id);
    upsilon.setShared("bot0_char_id", upsilon.myCharacters()[0].id);
}
upsilon.syncGroup("attackwc_ready", agentCount);
const sharedMatchId = upsilon.getShared("match_id");

// Only bot 1 attempts the illegal action.
if (agentIndex === 1) {
    const opponentCharId = upsilon.getShared("bot0_char_id");
    upsilon.assert(!!opponentCharId, "bot0_char_id missing from shared state");

    let rejected = false;
    let rounds = 0;
    while (!rejected && rounds < 60) {
        rounds++;
        const board = upsilon.waitNextTurn();
        if (!board) break;

        const foes = upsilon.myFoesCharacters().filter(f => f.hp > 0);
        if (foes.length === 0) break;

        // Attempt attack using opponent's character id.
        try {
            upsilon.call("game_action", {
                id: sharedMatchId,
                type: "attack",
                entity_id: opponentCharId,
                target_coords: [foes[0].position]
            });
            upsilon.assert(false, "ERROR: Wrong-controller attack accepted");
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] ✅ Wrong-controller attack rejected: ${e.message} (key=${e.error_key})`);
            upsilon.assertEquals(e.error_key, "entity.controller.missmatch", "Expected entity.controller.missmatch");
            rejected = true;
        }

        // End the turn cleanly with our own entity.
        const me = upsilon.currentCharacter();
        upsilon.call("game_action", { id: sharedMatchId, type: "pass", entity_id: me.id });
    }
    upsilon.assert(rejected, "Never exercised the wrong-controller attack path");
} else {
    // Bot 0 just plays normally so the match progresses.
    let rounds = 0;
    while (rounds < 60) {
        rounds++;
        const board = upsilon.waitNextTurn();
        if (!board) break;
        upsilon.autoBattleTurn(sharedMatchId);
    }
}

upsilon.log(`[Bot-${agentIndex}] EC-11: ATTACK WRONG CONTROLLER PASSED.`);
