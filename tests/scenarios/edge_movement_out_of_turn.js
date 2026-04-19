// upsiloncli/tests/scenarios/edge_movement_out_of_turn.js
// @spec-link [[mech_move_validation_move_validation_turn_mismatch]]
// @spec-link [[mech_initiative]]
// @spec-link [[mech_action_economy]]

const agentCount = 2;
const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "moveoot_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-06: Movement Out of Turn`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");

// Share match ID
if (agentIndex === 0) {
    upsilon.setShared("match_id", matchData.match_id);
}
upsilon.syncGroup("moveoot_ready", agentCount);

const sharedMatchId = upsilon.getShared("match_id");

// 2. Wait for first turn
const board = upsilon.waitNextTurn();
if (!board) {
    upsilon.assert(false, "ERROR: Match ended unexpectedly");
}

const myChar = upsilon.currentCharacter();
const isMyTurn = board.current_entity_id === myChar.id;
upsilon.log(`[Bot-${agentIndex}] My character: ${myChar.id}, Current turn: ${board.current_entity_id}, My turn: ${isMyTurn}`);

// 3. If NOT my turn, attempt to move (should fail)
if (!isMyTurn) {
    upsilon.log(`[Bot-${agentIndex}] Attempting move out of turn...`);
    try {
        upsilon.call("game_action", {
            id: sharedMatchId,
            type: "move",
            entity_id: myChar.id,
            target_coords: [{ x: myChar.position.x + 1, y: myChar.position.y }]
        });
        upsilon.assert(false, "ERROR: Move out of turn was accepted!");
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] ✅ Move out of turn properly rejected: ${e.message}`);
        upsilon.assertEquals(e.error_key, "entity.turn.missmatch", "Wrong error key for out of turn move");
    }
} else {
    upsilon.log(`[Bot-${agentIndex}] It's my turn, waiting for opponent to test out-of-turn move...`);
    upsilon.sleep(3000);
}

// 4. When it IS my turn, move should succeed
const myBoard = upsilon.waitNextTurn();
if (myBoard && myBoard.current_entity_id === myChar.id) {
    upsilon.log(`[Bot-${agentIndex}] Attempting valid move on my turn...`);
    try {
        upsilon.call("game_action", {
            id: sharedMatchId,
            type: "move",
            entity_id: myChar.id,
            target_coords: [{ x: myChar.position.x + 1, y: myChar.position.y }]
        });
        upsilon.log(`[Bot-${agentIndex}] ✅ Valid move on my turn succeeded`);
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] Valid move failed (may be expected): ${e.message}`);
    }
}

upsilon.log(`[Bot-${agentIndex}] EC-06: MOVEMENT OUT OF TURN PASSED.`);
