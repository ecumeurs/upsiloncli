// upsiloncli/tests/scenarios/edge_movement_obstacle_collision.js
// @test-link [[mech_move_validation]]
// @test-link [[mech_board_generation]]
// @test-link [[entity_grid]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "obstacle_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-01: Movement Onto Obstacle Tile`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVE");

// 2. Wait for first turn
const board = upsilon.waitNextTurn();
if (!board) {
    upsilon.assert(false, "ERROR: Match ended unexpectedly");
}

const myChar = upsilon.currentCharacter();
const startPos = myChar.position;
upsilon.log(`[Bot-${agentIndex}] Character at: ${startPos.x},${startPos.y}`);

// 3. Find an obstacle ADJACENT (Manhattan distance 1) to the start position.
// Board generation places obstacles at the surface (topmost) cell of a column,
// so an orthogonal single-step onto one is horizontally adjacent and within the
// Z-jump limit; the engine must therefore reach the cell-type check and reject
// with entity.path.obstacle (not entity.path.notadjacent). forEachCell is the
// sanctioned iterator over the 2D board projection (see [[ISS-079]]).
let adjacentObstacle = upsilon.forEachCell(board, (c) => {
    if (c.obstacle && (Math.abs(c.x - startPos.x) + Math.abs(c.y - startPos.y)) === 1) {
        return c;
    }
    return null;
});

// No adjacent obstacle is a hard failure: it means board generation did not
// place an obstacle within reach of the spawn, so this edge cannot be exercised.
upsilon.assert(!!adjacentObstacle,
    "FINDING: No obstacle tile orthogonally adjacent to spawn; board generation " +
    "does not guarantee an obstacle near the entity start position.");
upsilon.log(`[Bot-${agentIndex}] Found adjacent obstacle at ${adjacentObstacle.x},${adjacentObstacle.y}`);

// 4. Single-step move directly onto the obstacle cell. The bridge resolves the
// omitted Z to the topmost cell (the obstacle), so the engine hits the
// cell-type check and must reject with exactly entity.path.obstacle.
upsilon.log(`[Bot-${agentIndex}] Attempting single-step move onto obstacle (${adjacentObstacle.x},${adjacentObstacle.y})...`);
try {
    upsilon.call("game_action", {
        id: matchData.match_id,
        type: "move",
        entity_id: myChar.id,
        target_coords: [{ x: adjacentObstacle.x, y: adjacentObstacle.y }]
    });
    upsilon.assert(false, "ERROR: Move onto obstacle tile was accepted by the server!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Obstacle collision rejected: ${e.message} (key=${e.error_key})`);
    upsilon.assertEquals(e.error_key, "entity.path.obstacle",
        "Expected exactly entity.path.obstacle, got: " + e.error_key);
}

// 5. Verify position is unchanged after the rejected move.
const refreshed = upsilon.call("game_state", { id: matchData.match_id });
const me = refreshed.game_state.players.flatMap(p => p.entities).find(e => e.id === myChar.id);
upsilon.assertEquals(me.position.x, startPos.x, "Character X moved after rejected obstacle move");
upsilon.assertEquals(me.position.y, startPos.y, "Character Y moved after rejected obstacle move");
upsilon.log(`[Bot-${agentIndex}] ✅ Position unchanged (${me.position.x},${me.position.y})`);

upsilon.log(`[Bot-${agentIndex}] EC-01: MOVEMENT ONTO OBSTACLE TILE PASSED.`);
