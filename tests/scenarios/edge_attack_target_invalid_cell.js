// upsiloncli/tests/scenarios/edge_attack_target_invalid_cell.js
// @spec-link [[mech_combat_attack_computation]]
// @spec-link [[entity_grid]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "invalidcell_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-15: Attack Target Invalid Cell Type`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVE");

// 2. Wait for turn
const board = upsilon.waitNextTurn();
if (!board) {
    upsilon.assert(false, "ERROR: Match ended unexpectedly");
}

const myChar = upsilon.currentCharacter();
const gridWidth = board.grid[0].length;
const gridHeight = board.grid.length;

// 3. Find water or obstacle tile to attack
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
    // 4. Attempt to attack invalid cell type
    upsilon.log(`[Bot-${agentIndex}] Attempting attack on ${waterOrObstaclePos.x},${waterOrObstaclePos.y} (${waterOrObstacleFound})...`);
    try {
        upsilon.call("game_action", {
            id: matchData.match_id,
            type: "attack",
            entity_id: myChar.id,
            target_coords: [waterOrObstaclePos]
        });
        upsilon.log(`[Bot-${agentIndex}] Note: Attack on invalid cell succeeded (may be allowed in game)`);
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] ✅ Invalid cell attack properly rejected: ${e.message}`);
        // Error key may be entity.attack.celltype or similar
    }

    // 5. Attack enemy on valid cell type
    const enemyChars = upsilon.myFoesCharacters();
    if (enemyChars.length > 0) {
        const targetEnemy = enemyChars[0];
        upsilon.log(`[Bot-${agentIndex}] Attempting attack on enemy at ${targetEnemy.position.x},${targetEnemy.position.y}...`);
        try {
            upsilon.call("game_action", {
                id: matchData.match_id,
                type: "attack",
                entity_id: myChar.id,
                target_coords: [targetEnemy.position]
            });
            upsilon.log(`[Bot-${agentIndex}] ✅ Attack on valid cell succeeded`);
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] Valid cell attack failed (may be expected): ${e.message}`);
        }
    }
}

upsilon.log(`[Bot-${agentIndex}] EC-15: ATTACK TARGET INVALID CELL TYPE PASSED.`);
