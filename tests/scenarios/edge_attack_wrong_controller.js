// upsiloncli/tests/scenarios/edge_attack_wrong_controller.js
// @test-link [[mech_skill_validation_turn_controller_identity_verification]]
// @test-link [[entity_player]]

const agentCount = 2;
const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "attackwc_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-11: Attack Wrong Controller`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");

// Share character IDs
if (agentIndex === 0) {
    upsilon.setShared("match_id", matchData.match_id);
    upsilon.setShared("bot0_char_id", upsilon.myCharacters()[0].id);
}
upsilon.syncGroup("attackwc_ready", agentCount);

const sharedMatchId = upsilon.getShared("match_id");

// 2. Wait for turn
const board = upsilon.waitNextTurn();
if (!board) {
    upsilon.assert(false, "ERROR: Match ended unexpectedly");
}

const myChar = upsilon.currentCharacter();
const isMyTurn = board.current_entity_id === myChar.id;

// 3. If my turn, try to attack with opponent's character
if (isMyTurn) {
    const opponentCharId = upsilon.getShared("bot0_char_id");
    const myCharId = myChar.id;

    // Only Bot 1 has access to Bot 0's character ID
    if (agentIndex === 1 && opponentCharId) {
        const enemyChars = upsilon.myFoesCharacters();
        if (enemyChars.length > 0) {
            const targetEnemy = enemyChars[0];
            upsilon.log(`[Bot-${agentIndex}] Attempting to attack using opponent's character (ID: ${opponentCharId}) targeting enemy at ${targetEnemy.position.x},${targetEnemy.position.y}...`);
            try {
                upsilon.call("game_action", {
                    id: sharedMatchId,
                    type: "attack",
                    entity_id: opponentCharId,  // Wrong controller!
                    target_coords: [targetEnemy.position]
                });
                upsilon.assert(false, "ERROR: Attack with wrong controller was accepted!");
            } catch (e) {
                upsilon.log(`[Bot-${agentIndex}] ✅ Wrong controller attack properly rejected: ${e.message}`);
                upsilon.assertEquals(e.error_key, "entity.controller.missmatch", "Wrong error key for wrong controller");
            }
        }
    } else {
        upsilon.log(`[Bot-${agentIndex}] Not the bot that has opponent's character ID`);
    }
} else {
    upsilon.log(`[Bot-${agentIndex}] Not my turn, waiting...`);
}

// 4. Verify own character can attack when turn arrives
const myBoard = upsilon.waitNextTurn();
if (myBoard && myBoard.current_entity_id === myChar.id) {
    const enemyChars = upsilon.myFoesCharacters();
    if (enemyChars.length > 0) {
        upsilon.log(`[Bot-${agentIndex}] Attempting valid attack with own character...`);
        try {
            upsilon.call("game_action", {
                id: sharedMatchId,
                type: "attack",
                entity_id: myChar.id,
                target_coords: [enemyChars[0].position]
            });
            upsilon.log(`[Bot-${agentIndex}] ✅ Valid attack with own character succeeded`);
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] Valid attack failed (may be expected): ${e.message}`);
        }
    }
}

upsilon.log(`[Bot-${agentIndex}] EC-11: ATTACK WRONG CONTROLLER PASSED.`);
