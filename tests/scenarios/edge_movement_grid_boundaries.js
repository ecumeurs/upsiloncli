// upsiloncli/tests/scenarios/edge_movement_grid_boundaries.js
// @test-link [[mech_move_validation]]
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

upsilon.log(`[Bot-${agentIndex}] Character at: ${startPos.x},${startPos.y}`);

// 3. Attempt to move to a negative (out-of-bounds) coordinate.
// The grid only spans [0,Width) x [0,Length); a negative coordinate resolves to
// no cell, so CellsForPositions returns fewer cells than the path and the move
// is rejected with entity.path.notfound (the single grid-boundary guard).
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
    upsilon.log(`[Bot-${agentIndex}] ✅ Out-of-bounds coordinate properly rejected: ${e.message} (key=${e.error_key})`);
    upsilon.assertEquals(e.error_key, "entity.path.notfound", "Expected entity.path.notfound for out-of-bounds move");
}

// 4. Verify position unchanged
const updatedBoard = upsilon.call("game_state", { id: matchData.match_id });
const updatedChar = updatedBoard.game_state.players.flatMap(p => p.entities).find(e => e.id === myChar.id);
upsilon.assertEquals(updatedChar.position.x, startPos.x, "Character X position changed after failed move");
upsilon.assertEquals(updatedChar.position.y, startPos.y, "Character Y position changed after failed move");
upsilon.log(`[Bot-${agentIndex}] ✅ Position unchanged (${updatedChar.position.x},${updatedChar.position.y})`);

upsilon.log(`[Bot-${agentIndex}] EC-08: MOVEMENT GRID BOUNDARIES PASSED.`);
