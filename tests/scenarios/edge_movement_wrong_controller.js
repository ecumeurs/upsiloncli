// upsiloncli/tests/scenarios/edge_movement_wrong_controller.js
// @test-link [[mech_move_validation_move_validation_controller_mismatch]]
// @test-link [[entity_player]]

const agentCount = 2;
const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "wrongctrl_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-07: Movement Wrong Controller`);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");

if (agentIndex === 0) {
    upsilon.setShared("match_id", matchData.match_id);
    upsilon.setShared("bot0_char_id", upsilon.myCharacters()[0].id);
}
upsilon.syncGroup("wrongctrl_ready", agentCount);
const sharedMatchId = upsilon.getShared("match_id");

if (agentIndex === 1) {
    const opponentCharId = upsilon.getShared("bot0_char_id");
    upsilon.assert(!!opponentCharId, "Shared opponent char ID missing");

    let rejected = false;
    let rounds = 0;
    while (!rejected && rounds < 60) {
        rounds++;
        const board = upsilon.waitNextTurn();
        if (!board) break;
        const me = upsilon.currentCharacter();

        try {
            upsilon.call("game_action", {
                id: sharedMatchId,
                type: "move",
                entity_id: opponentCharId,
                target_coords: [{ x: me.position.x, y: me.position.y }]
            });
            upsilon.assert(false, "ERROR: Move with wrong controller accepted");
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] ✅ Wrong-controller move rejected: ${e.message} (key=${e.error_key})`);
            upsilon.assertEquals(e.error_key, "entity.controller.missmatch", "Expected entity.controller.missmatch");
            rejected = true;
        }

        upsilon.call("game_action", { id: sharedMatchId, type: "pass", entity_id: me.id });
    }
    upsilon.assert(rejected, "Never hit the wrong-controller move case");
} else {
    let rounds = 0;
    while (rounds < 60) {
        rounds++;
        const board = upsilon.waitNextTurn();
        if (!board) break;
        upsilon.autoBattleTurn(sharedMatchId);
    }
}

upsilon.log(`[Bot-${agentIndex}] EC-07: MOVEMENT WRONG CONTROLLER PASSED.`);
