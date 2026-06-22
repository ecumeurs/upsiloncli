// upsiloncli/tests/scenarios/edge_movement_path_not_adjacent.js
// @test-link [[mech_move_validation_path_adjacency]]
// @test-link [[entity_grid]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "notadjacent_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-05: Movement Path Not Adjacent`);

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

// 3. Attempt to move with a non-adjacent path (skip one tile).
// Spawn position is randomly seeded, so a fixed offset can land outside the
// grid and trip entity.path.notfound instead of the entity.path.notadjacent
// we're after here. Try every axis/direction and use the first jump that
// actually stays in bounds.
const candidates = [
    { x: startPos.x + 2, y: startPos.y },
    { x: startPos.x - 2, y: startPos.y },
    { x: startPos.x, y: startPos.y + 2 },
    { x: startPos.x, y: startPos.y - 2 },
];
const nonAdjacentPath = candidates.find(p => p.x >= 0 && p.x < gridWidth && p.y >= 0 && p.y < gridHeight);
upsilon.assert(!!nonAdjacentPath, "ERROR: No in-bounds non-adjacent jump available from this spawn position");

upsilon.log(`[Bot-${agentIndex}] Attempting non-adjacent move to (${nonAdjacentPath.x},${nonAdjacentPath.y}) (jump)...`);
try {
    upsilon.call("game_action", {
        id: matchData.match_id,
        type: "move",
        entity_id: myChar.id,
        target_coords: [nonAdjacentPath]
    });
    upsilon.assert(false, "ERROR: Non-adjacent path was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Non-adjacent path properly rejected: ${e.message} (key=${e.error_key})`);
    upsilon.assertEquals(e.error_key, "entity.path.notadjacent", "Expected entity.path.notadjacent");
}

// Verify position unchanged
const updatedBoard = upsilon.call("game_state", { id: matchData.match_id });
const updatedChar = updatedBoard.game_state.players.flatMap(p => p.entities).find(e => e.id === myChar.id);
upsilon.assertEquals(updatedChar.position.x, startPos.x, "Character X position changed after failed move");
upsilon.assertEquals(updatedChar.position.y, startPos.y, "Character Y position changed after failed move");
upsilon.log(`[Bot-${agentIndex}] ✅ Position unchanged (${updatedChar.position.x},${updatedChar.position.y})`);

// 4. Attempt a valid adjacent move, one step in the same direction we just jumped.
const validPath = [
    {
        x: startPos.x + Math.sign(nonAdjacentPath.x - startPos.x),
        y: startPos.y + Math.sign(nonAdjacentPath.y - startPos.y),
    }
];
upsilon.log(`[Bot-${agentIndex}] Attempting valid adjacent move...`);
try {
    upsilon.call("game_action", {
        id: matchData.match_id,
        type: "move",
        entity_id: myChar.id,
        target_coords: validPath
    });
    upsilon.log(`[Bot-${agentIndex}] ✅ Valid adjacent move succeeded`);
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] Valid move failed (may be expected): ${e.message}`);
}

upsilon.log(`[Bot-${agentIndex}] EC-05: MOVEMENT PATH NOT ADJACENT PASSED.`);
