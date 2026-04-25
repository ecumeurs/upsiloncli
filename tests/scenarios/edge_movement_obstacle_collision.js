// upsiloncli/tests/scenarios/edge_movement_obstacle_collision.js
// @test-link [[mech_move_validation_move_validation_obstacle_collision]]
// @test-link [[mech_board_generation_terrain_obstacles]]
// @test-link [[entity_grid]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "obstacle_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-01: Movement on Obstacle Tiles`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVE");

// 2. Wait for first turn
const board = upsilon.waitNextTurn();
if (!board) { upsilon.assert(false, "ERROR: Match ended unexpectedly"); }

const myChar = upsilon.currentCharacter();
const startPos = myChar.position;

// 3. Find an obstacle through the sanctioned iterator. forEachCell handles the
// underlying storage layout; see [[ISS-079]].
let obstacleCell = upsilon.forEachCell(board, (c) => c.obstacle ? c : null);

if (!obstacleCell) {
    upsilon.log(`[Bot-${agentIndex}] SKIP: No obstacles found on this board`);
} else {
    upsilon.log(`[Bot-${agentIndex}] Found obstacle at ${obstacleCell.x},${obstacleCell.y}`);

    // Attempt to move *onto* the obstacle via planTravelToward; the engine must
    // reject with entity.path.obstacle (or similar path.* rejection).
    const path = upsilon.planTravelToward(myChar.id, { x: obstacleCell.x, y: obstacleCell.y }, board);
    if (path.length > 0) {
        // Force the last step to target the obstacle cell so we can assert rejection.
        path[path.length - 1] = { x: obstacleCell.x, y: obstacleCell.y };
        try {
            upsilon.call("game_action", {
                id: matchData.match_id,
                type: "move",
                entity_id: myChar.id,
                target_coords: path
            });
            upsilon.assert(false, "ERROR: Movement through obstacle was accepted by server!");
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] ✅ Obstacle collision rejected: ${e.message} (key=${e.error_key})`);
            upsilon.assert(
                (e.error_key || "").indexOf("entity.path.") === 0,
                "Expected path-family error_key, got: " + e.error_key
            );
        }

        // Position must be unchanged
        const refreshed = upsilon.call("game_state", { id: matchData.match_id });
        const me = refreshed.game_state.players.flatMap(p => p.entities).find(e => e.id === myChar.id);
        upsilon.assertEquals(me.position.x, startPos.x, "Character X moved after failed move");
        upsilon.assertEquals(me.position.y, startPos.y, "Character Y moved after failed move");
    } else {
        upsilon.log(`[Bot-${agentIndex}] SKIP: No path to obstacle available`);
    }
}

upsilon.log(`[Bot-${agentIndex}] EC-01: MOVEMENT ON OBSTACLE TILES PASSED.`);
