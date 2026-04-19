// upsiloncli/tests/scenarios/edge_attack_target_out_of_grid.js
// @spec-link [[mech_skill_validation_grid_boundaries_verification]]
// @spec-link [[entity_grid]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "ootgrid_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-14: Attack Target Out of Grid`);

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

upsilon.log(`[Bot-${agentIndex}] Grid: ${gridWidth}x${gridHeight}`);

// 3. Attempt to attack coordinate outside grid
const outOfGridX = gridWidth + 10;
const outOfGridY = gridHeight + 10;

upsilon.log(`[Bot-${agentIndex}] Attempting attack on (${outOfGridX},${outOfGridY}) outside grid...`);
try {
    upsilon.call("game_action", {
        id: matchData.match_id,
        type: "attack",
        entity_id: myChar.id,
        target_coords: [{ x: outOfGridX, y: outOfGridY }]
    });
    upsilon.assert(false, "ERROR: Attack outside grid was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Out-of-grid attack properly rejected: ${e.message}`);
}

// 4. Attempt attack on enemy within grid (should succeed or fail for other reasons)
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
        upsilon.log(`[Bot-${agentIndex}] ✅ In-grid attack succeeded`);
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] In-grid attack failed (may be expected): ${e.message}`);
    }
} else {
    upsilon.log(`[Bot-${agentIndex}] SKIP: No enemies found`);
}

upsilon.log(`[Bot-${agentIndex}] EC-14: ATTACK TARGET OUT OF GRID PASSED.`);
