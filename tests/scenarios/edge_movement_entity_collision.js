// upsiloncli/tests/scenarios/edge_movement_entity_collision.js
// @test-link [[mech_move_validation_move_validation_entity_collision]]
// @test-link [[entity_character]]

const agentCount = 2;
const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "entitycol_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-02: Movement on Entity Collision`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");

// Share identity for coordination
if (agentIndex === 0) {
    upsilon.setShared("match_id", matchData.match_id);
}
upsilon.syncGroup("entitycol_ready", agentCount);

const sharedMatchId = upsilon.getShared("match_id");

// 2. Wait for turn and find another player's character position
const board = upsilon.waitNextTurn();
if (!board) {
    upsilon.assert(false, "ERROR: Match ended unexpectedly");
}

const myChar = upsilon.currentCharacter();
const enemyChars = upsilon.myFoesCharacters();

if (enemyChars.length > 0) {
    const targetEnemy = enemyChars[0];
    upsilon.log(`[Bot-${agentIndex}] Enemy at: ${targetEnemy.position.x},${targetEnemy.position.y}`);

    // 3. Attempt to move to occupied tile
    upsilon.log(`[Bot-${agentIndex}] Attempting to move to occupied tile...`);
    try {
        upsilon.call("game_action", {
            id: sharedMatchId,
            type: "move",
            entity_id: myChar.id,
            target_coords: [targetEnemy.position]
        });
        upsilon.assert(false, "ERROR: Movement to occupied tile was accepted!");
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] ✅ Entity collision properly rejected: ${e.message}`);
        upsilon.assertEquals(e.error_key, "entity.path.occupied", "Wrong error key for entity collision");
    }

    // Verify position unchanged
    const updatedBoard = upsilon.call("game_state", { id: sharedMatchId });
    const updatedChar = updatedBoard.data.players.find(p => p.entities.find(e => e.id === myChar.id));
    const updatedEntity = updatedChar.entities.find(e => e.id === myChar.id);
    upsilon.assertEquals(updatedEntity.position.x, myChar.position.x, "Character X position changed after failed move");
    upsilon.assertEquals(updatedEntity.position.y, myChar.position.y, "Character Y position changed after failed move");
    upsilon.log(`[Bot-${agentIndex}] ✅ Position unchanged (${updatedEntity.position.x},${updatedEntity.position.y})`);
} else {
    upsilon.log(`[Bot-${agentIndex}] SKIP: No enemies found`);
}

upsilon.log(`[Bot-${agentIndex}] EC-02: MOVEMENT ON ENTITY COLLISION PASSED.`);
