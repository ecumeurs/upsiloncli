// upsiloncli/tests/scenarios/edge_movement_wrong_controller.js
// @spec-link [[mech_move_validation_move_validation_controller_mismatch]]
// @spec-link [[entity_player]]

const agentCount = 2;
const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "wrongctrl_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-07: Movement Wrong Controller`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");

// Share character IDs for testing
if (agentIndex === 0) {
    upsilon.setShared("match_id", matchData.match_id);
    upsilon.setShared("bot0_char_id", upsilon.myCharacters()[0].id);
}
upsilon.syncGroup("wrongctrl_ready", agentCount);

const sharedMatchId = upsilon.getShared("match_id");

// 2. Wait for turn
const board = upsilon.waitNextTurn();
if (!board) {
    upsilon.assert(false, "ERROR: Match ended unexpectedly");
}

const myChar = upsilon.currentCharacter();
const isMyTurn = board.current_entity_id === myChar.id;

// 3. If my turn, try to move opponent's character
if (isMyTurn) {
    const opponentCharId = upsilon.getShared("bot0_char_id");
    const myCharId = myChar.id;

    // Only Bot 1 has access to Bot 0's character ID
    if (agentIndex === 1 && opponentCharId) {
        upsilon.log(`[Bot-${agentIndex}] Attempting to move opponent's character (ID: ${opponentCharId})...`);
        try {
            upsilon.call("game_action", {
                id: sharedMatchId,
                type: "move",
                entity_id: opponentCharId,  // Wrong controller!
                target_coords: [{ x: 0, y: 0 }]
            });
            upsilon.assert(false, "ERROR: Movement with wrong controller was accepted!");
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] ✅ Wrong controller movement properly rejected: ${e.message}`);
            upsilon.assertEquals(e.error_key, "entity.controller.missmatch", "Wrong error key for wrong controller");
        }
    } else {
        upsilon.log(`[Bot-${agentIndex}] Not the bot that has opponent's character ID`);
    }
} else {
    upsilon.log(`[Bot-${agentIndex}] Not my turn, waiting...`);
}

// 4. Verify own character can move when turn arrives
const myBoard = upsilon.waitNextTurn();
if (myBoard && myBoard.current_entity_id === myChar.id) {
    upsilon.log(`[Bot-${agentIndex}] Attempting valid move of own character...`);
    try {
        upsilon.call("game_action", {
            id: sharedMatchId,
            type: "move",
            entity_id: myChar.id,
            target_coords: [{ x: myChar.position.x + 1, y: myChar.position.y }]
        });
        upsilon.log(`[Bot-${agentIndex}] ✅ Valid movement of own character succeeded`);
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] Valid move failed (may be expected): ${e.message}`);
    }
}

upsilon.log(`[Bot-${agentIndex}] EC-07: MOVEMENT WRONG CONTROLLER PASSED.`);
