// upsiloncli/tests/scenarios/edge_movement_path_not_adjacent.js
// @spec-link [[mech_move_validation_move_validation_path_adjacency]]
// @spec-link [[entity_grid]]

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
upsilon.log(`[Bot-${agentIndex}] Character at: ${startPos.x},${startPos.y}`);

// 3. Attempt to move with non-adjacent path (jump)
const nonAdjacentPath = [
    { x: startPos.x + 2, y: startPos.y }  // Skips adjacent tile
];

upsilon.log(`[Bot-${agentIndex}] Attempting non-adjacent move (jump)...`);
try {
    upsilon.call("game_action", {
        id: matchData.match_id,
        type: "move",
        entity_id: myChar.id,
        target_coords: nonAdjacentPath
    });
    upsilon.assert(false, "ERROR: Non-adjacent path was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Non-adjacent path properly rejected: ${e.message}`);
    upsilon.assertEquals(e.error_key, "entity.path.notadjascent", "Wrong error key for non-adjacent path");
}

// Verify position unchanged
const updatedBoard = upsilon.call("game_state", { id: matchData.match_id });
const updatedChar = updatedBoard.data.players[0].entities.find(e => e.id === myChar.id);
upsilon.assertEquals(updatedChar.position.x, startPos.x, "Character X position changed after failed move");
upsilon.assertEquals(updatedChar.position.y, startPos.y, "Character Y position changed after failed move");
upsilon.log(`[Bot-${agentIndex}] ✅ Position unchanged (${updatedChar.position.x},${updatedChar.position.y})`);

// 4. Attempt valid adjacent move
const validPath = [
    { x: startPos.x + 1, y: startPos.y }
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
