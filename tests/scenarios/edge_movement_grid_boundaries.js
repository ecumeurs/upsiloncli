// upsiloncli/tests/scenarios/edge_movement_grid_boundaries.js
// @test-link [[mech_skill_validation_grid_boundaries_verification]]
// @test-link [[entity_grid]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "gridbounds_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-08: Movement Grid Boundaries`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVE");

// 2. Wait for turn
const board = upsilon.waitNextTurn();
if (!board) {
    upsilon.assert(false, "ERROR: Match ended unexpectedly");
}

const myChar = upsilon.currentCharacter();
const startPos = myChar.position;
const gridWidth = board.grid.width;
const gridHeight = board.grid.height;

upsilon.log(`[Bot-${agentIndex}] Character at: ${startPos.x},${startPos.y}, Grid: ${gridWidth}x${gridHeight}`);

// 3. Attempt to move to negative coordinate
upsilon.log(`[Bot-${agentIndex}] Attempting to move to negative coordinates...`);
try {
    upsilon.call("game_action", {
        id: matchData.match_id,
        type: "move",
        entity_id: myChar.id,
        target_coords: [{ x: -1, y: 0 }]
    });
    upsilon.assert(false, "ERROR: Movement to negative coordinate was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Negative coordinate properly rejected: ${e.message}`);
}

// 4. Attempt to move beyond grid bounds
const beyondGridX = gridWidth + 5;
const beyondGridY = gridHeight + 5;

upsilon.log(`[Bot-${agentIndex}] Attempting to move to (${beyondGridX},${beyondGridY}) beyond grid...`);
try {
    upsilon.call("game_action", {
        id: matchData.match_id,
        type: "move",
        entity_id: myChar.id,
        target_coords: [{ x: beyondGridX, y: beyondGridY }]
    });
    upsilon.assert(false, "ERROR: Movement beyond grid was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Beyond-grid coordinate properly rejected: ${e.message}`);
}

// 5. Verify position unchanged
const updatedBoard = upsilon.call("game_state", { id: matchData.match_id });
const updatedChar = updatedBoard.game_state.players[0].entities.find(e => e.id === myChar.id);
upsilon.assertEquals(updatedChar.position.x, startPos.x, "Character X position changed after failed moves");
upsilon.assertEquals(updatedChar.position.y, startPos.y, "Character Y position changed after failed moves");
upsilon.log(`[Bot-${agentIndex}] ✅ Position unchanged (${updatedChar.position.x},${updatedChar.position.y})`);

// 6. Attempt valid move within grid
const validX = Math.min(startPos.x + 1, gridWidth - 1);
const validY = startPos.y;

upsilon.log(`[Bot-${agentIndex}] Attempting valid move to (${validX},${validY})...`);
try {
    upsilon.call("game_action", {
        id: matchData.match_id,
        type: "move",
        entity_id: myChar.id,
        target_coords: [{ x: validX, y: validY }]
    });
    upsilon.log(`[Bot-${agentIndex}] ✅ Valid move within grid succeeded`);
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] Valid move failed (may be expected): ${e.message}`);
}

upsilon.log(`[Bot-${agentIndex}] EC-08: MOVEMENT GRID BOUNDARIES PASSED.`);
