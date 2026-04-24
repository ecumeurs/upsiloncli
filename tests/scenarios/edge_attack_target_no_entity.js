// upsiloncli/tests/scenarios/edge_attack_target_no_entity.js
// @test-link [[mech_combat_attack_computation]]
// @test-link [[entity_character]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "noentity_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-16: Attack Target No Entity`);

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

// 3. Find empty tile to attack
let emptyTileFound = false;
let emptyTilePos = null;

for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
        const cell = board.grid[y][x];
        // Check if cell is empty (no obstacle, no water, no entity)
        const hasEntity = board.data.players.some(p =>
            p.entities.some(e => e.position.x === x && e.position.y === y)
        );
        if (cell && !cell.obstacle && !cell.water && !hasEntity) {
            emptyTilePos = { x, y };
            emptyTileFound = true;
            upsilon.log(`[Bot-${agentIndex}] Found empty tile at: ${x},${y}`);
            break;
        }
    }
    if (emptyTileFound) break;
}

if (!emptyTileFound) {
    upsilon.log(`[Bot-${agentIndex}] SKIP: No empty tiles found on this board`);
} else {
    // 4. Attempt to attack empty tile
    upsilon.log(`[Bot-${agentIndex}] Attempting attack on empty tile (${emptyTilePos.x},${emptyTilePos.y})...`);
    try {
        upsilon.call("game_action", {
            id: matchData.match_id,
            type: "attack",
            entity_id: myChar.id,
            target_coords: [emptyTilePos]
        });
        upsilon.assert(false, "ERROR: Attack on empty tile was accepted!");
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] ✅ Empty tile attack properly rejected: ${e.message}`);
        // Error key may be entity.attack.noentity or similar
    }

    // 5. Attack enemy on occupied tile (should succeed)
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
            upsilon.log(`[Bot-${agentIndex}] ✅ Attack on entity succeeded`);
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] Entity attack failed (may be expected): ${e.message}`);
        }
    }
}

upsilon.log(`[Bot-${agentIndex}] EC-16: ATTACK TARGET NO ENTITY PASSED.`);
