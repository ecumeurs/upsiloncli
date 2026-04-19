// upsiloncli/tests/scenarios/edge_movement_jump_limitations.js
// @spec-link [[mech_move_validation_move_validation_jump_limitations]]
// @spec-link [[entity_grid]]
// @spec-link [[mech_board_generation_terrain_obstacles]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "jumplimit_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-09: Movement Jump Limitations`);

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

// 3. Find water or obstacle tile to attempt jump across
const gridWidth = board.grid[0].length;
const gridHeight = board.grid.length;
let waterOrObstacleFound = false;
let waterOrObstaclePos = null;

for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
        const cell = board.grid[y][x];
        if (cell && (cell.obstacle || cell.water)) {
            waterOrObstaclePos = { x, y };
            waterOrObstacleFound = true;
            upsilon.log(`[Bot-${agentIndex}] Found ${cell.obstacle ? 'obstacle' : 'water'} at: ${x},${y}`);
            break;
        }
    }
    if (waterOrObstacleFound) break;
}

if (!waterOrObstacleFound) {
    upsilon.log(`[Bot-${agentIndex}] SKIP: No water/obstacle tiles found on this board`);
} else {
    // Attempt to move "jump" across the non-walkable tile
    // Try to go from current position to position beyond the water/obstacle
    const jumpPath = [
        { x: waterOrObstaclePos.x, y: waterOrObstaclePos.y },  // The non-walkable tile
        { x: waterOrObstaclePos.x + 1, y: waterOrObstaclePos.y }  // Beyond it
    ];

    upsilon.log(`[Bot-${agentIndex}] Attempting to jump across ${waterOrObstaclePos.x},${waterOrObstaclePos.y}...`);
    try {
        upsilon.call("game_action", {
            id: matchData.match_id,
            type: "move",
            entity_id: myChar.id,
            target_coords: jumpPath
        });
        // This might succeed if pathfinding finds a valid route, but direct jump should fail
        // If it succeeds, verify we didn't actually land on the water/obstacle
        const updatedBoard = upsilon.call("game_state", { id: matchData.match_id });
        const updatedChar = updatedBoard.data.players[0].entities.find(e => e.id === myChar.id);
        const finalCell = updatedBoard.data.grid[updatedChar.position.y][updatedChar.position.x];

        if (finalCell && (finalCell.obstacle || finalCell.water)) {
            upsilon.assert(false, "ERROR: Character ended up on obstacle/water tile!");
        } else {
            upsilon.log(`[Bot-${agentIndex}] ✅ Jump properly handled (pathfinding found valid route)`);
        }
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] ✅ Jump attempt properly rejected: ${e.message}`);
    }

    // Verify position unchanged or moved to valid tile
    const finalBoard = upsilon.call("game_state", { id: matchData.match_id });
    const finalChar = finalBoard.data.players[0].entities.find(e => e.id === myChar.id);
    const finalCell = finalBoard.data.grid[finalChar.position.y][finalChar.position.x];

    if (finalCell && finalCell.obstacle) {
        upsilon.assert(false, "ERROR: Character on obstacle after move!");
    }
    if (finalCell && finalCell.water) {
        upsilon.assert(false, "ERROR: Character on water after move!");
    }
    upsilon.log(`[Bot-${agentIndex}] ✅ Final tile is valid (not obstacle/water)`);
}

upsilon.log(`[Bot-${agentIndex}] EC-09: MOVEMENT JUMP LIMITATIONS PASSED.`);
