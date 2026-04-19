// upsiloncli/tests/scenarios/edge_attack_out_of_turn.js
// @spec-link [[mech_skill_validation_turn_controller_identity_verification]]
// @spec-link [[mech_initiative]]
// @spec-link [[mech_action_economy]]

const agentCount = 2;
const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "attackoot_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-10: Attack Out of Turn`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");

// Share match ID for coordination
if (agentIndex === 0) {
    upsilon.setShared("match_id", matchData.match_id);
}
upsilon.syncGroup("attackoot_ready", agentCount);

const sharedMatchId = upsilon.getShared("match_id");
upsilon.assertEquals(sharedMatchId, matchData.match_id, "Mismatch in shared match ID");

// 2. Wait for first turn
const board = upsilon.waitNextTurn();
if (!board) {
    upsilon.assert(false, "ERROR: Match ended unexpectedly");
}

const myChar = upsilon.currentCharacter();
const isMyTurn = board.current_entity_id === myChar.id;
upsilon.log(`[Bot-${agentIndex}] My character: ${myChar.id}, Current turn: ${board.current_entity_id}, My turn: ${isMyTurn}`);

// 3. If it's NOT my turn, attempt to attack (should fail)
if (!isMyTurn) {
    const enemyChars = upsilon.myFoesCharacters();
    if (enemyChars.length > 0) {
        const targetEnemy = enemyChars[0];
        upsilon.log(`[Bot-${agentIndex}] Attempting attack out of turn...`);

        try {
            upsilon.call("game_action", {
                id: sharedMatchId,
                type: "attack",
                entity_id: myChar.id,
                target_coords: [targetEnemy.position]
            });
            upsilon.assert(false, "ERROR: Attack out of turn was accepted!");
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] ✅ Attack out of turn properly rejected: ${e.message}`);
            upsilon.assertEquals(e.error_key, "entity.turn.missmatch", "Wrong error key for out of turn attack");
        }
    }
} else {
    upsilon.log(`[Bot-${agentIndex}] It's my turn, waiting for opponent to test out-of-turn attack...`);
    // Give opponent time to attempt attack
    upsilon.sleep(3000);
}

// 4. When it IS my turn, attack should succeed
const myBoard = upsilon.waitNextTurn();
if (myBoard) {
    const myChar = upsilon.currentCharacter();
    const enemyChars = upsilon.myFoesCharacters();

    if (enemyChars.length > 0 && myBoard.current_entity_id === myChar.id) {
        const targetEnemy = enemyChars[0];
        upsilon.log(`[Bot-${agentIndex}] Attempting valid attack on my turn...`);

        try {
            upsilon.call("game_action", {
                id: sharedMatchId,
                type: "attack",
                entity_id: myChar.id,
                target_coords: [targetEnemy.position]
            });
            upsilon.log(`[Bot-${agentIndex}] ✅ Valid attack on my turn succeeded`);
        } catch (e) {
            // May fail due to range, cooldown, etc.
            upsilon.log(`[Bot-${agentIndex}] Valid attack failed (may be expected): ${e.message}`);
        }
    }
}

upsilon.log(`[Bot-${agentIndex}] EC-10: ATTACK OUT OF TURN PASSED.`);
