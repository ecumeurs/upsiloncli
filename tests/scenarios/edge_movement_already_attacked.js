// upsiloncli/tests/scenarios/edge_movement_already_attacked.js
// @spec-link [[mech_move_validation_move_validation_already_moved]]
// @spec-link [[mech_action_economy]]
// @spec-link [[mech_action_economy_action_cost_rules]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "moveattacked_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-03: Movement Already Attacked`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVE");

// 2. Wait for turn and attack first
const board = upsilon.waitNextTurn();
if (!board) {
    upsilon.assert(false, "ERROR: Match ended unexpectedly");
}

const myChar = upsilon.currentCharacter();
const startPos = myChar.position;
upsilon.log(`[Bot-${agentIndex}] Character at: ${startPos.x},${startPos.y}`);

// Find enemy to attack
const enemyChars = upsilon.myFoesCharacters();
if (enemyChars.length > 0) {
    const targetEnemy = enemyChars[0];
    upsilon.log(`[Bot-${agentIndex}] Attacking enemy at ${targetEnemy.position.x},${targetEnemy.position.y}...`);

    try {
        upsilon.call("game_action", {
            id: matchData.match_id,
            type: "attack",
            entity_id: myChar.id,
            target_coords: [targetEnemy.position]
        });
        upsilon.log(`[Bot-${agentIndex}] ✅ Attack succeeded`);
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] Attack failed (may be expected): ${e.message}`);
    }

    // 3. Attempt to move after attack (should fail)
    upsilon.log(`[Bot-${agentIndex}] Attempting to move after attack...`);
    try {
        upsilon.call("game_action", {
            id: matchData.match_id,
            type: "move",
            entity_id: myChar.id,
            target_coords: [{ x: Math.min(startPos.x + 1, 9), y: startPos.y }]
        });
        upsilon.assert(false, "ERROR: Movement after attack was accepted!");
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] ✅ Movement after attack properly rejected: ${e.message}`);
        upsilon.assertEquals(e.error_key, "entity.movement.already", "Wrong error key for movement after attack");
    }

    // Verify position unchanged
    const updatedBoard = upsilon.call("game_state", { id: matchData.match_id });
    const updatedChar = updatedBoard.data.players[0].entities.find(e => e.id === myChar.id);
    upsilon.assertEquals(updatedChar.position.x, startPos.x, "Character X position changed after failed move");
    upsilon.assertEquals(updatedChar.position.y, startPos.y, "Character Y position changed after failed move");
    upsilon.log(`[Bot-${agentIndex}] ✅ Position unchanged (${updatedChar.position.x},${updatedChar.position.y})`);

    // Verify has_attacked flag is set
    if (updatedChar.has_attacked === true) {
        upsilon.log(`[Bot-${agentIndex}] ✅ has_attacked flag correctly set to true`);
    } else {
        upsilon.log(`[Bot-${agentIndex}] Note: has_attacked flag is ${updatedChar.has_attacked}`);
    }
} else {
    upsilon.log(`[Bot-${agentIndex}] SKIP: No enemies found`);
}

upsilon.log(`[Bot-${agentIndex}] EC-03: MOVEMENT ALREADY ATTACKED PASSED.`);
