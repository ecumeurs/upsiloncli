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
if (!board) { upsilon.assert(false, "ERROR: Match ended unexpectedly"); }

const myChar = upsilon.currentCharacter();
const occupied = new Set(
    board.players.flatMap(p => p.entities.map(e => `${e.position.x},${e.position.y}`))
);

// 3. Locate an empty, walkable tile via the sanctioned iterator ([[ISS-079]]).
const emptyCell = upsilon.forEachCell(board, (c) => {
    if (c.obstacle) return null;
    if (occupied.has(`${c.x},${c.y}`)) return null;
    return c;
});

if (!emptyCell) {
    upsilon.log(`[Bot-${agentIndex}] SKIP: No empty tile found on this board`);
} else {
    upsilon.log(`[Bot-${agentIndex}] Attempting attack on empty tile (${emptyCell.x},${emptyCell.y})...`);
    try {
        upsilon.call("game_action", {
            id: matchData.match_id,
            type: "attack",
            entity_id: myChar.id,
            target_coords: [{ x: emptyCell.x, y: emptyCell.y }]
        });
        upsilon.assert(false, "ERROR: Attack on empty tile was accepted!");
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] ✅ Empty-tile attack rejected: ${e.message} (key=${e.error_key})`);
    }
}

upsilon.log(`[Bot-${agentIndex}] EC-16: ATTACK TARGET NO ENTITY PASSED.`);
