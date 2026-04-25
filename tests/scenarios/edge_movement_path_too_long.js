// upsiloncli/tests/scenarios/edge_movement_path_too_long.js
// @test-link [[mech_move_validation_move_validation_path_length_credits]]
// @test-link [[mech_action_economy]]
// @test-link [[entity_character]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "pathtoolong_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-04: Movement Path Too Long`);

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
const moveCredits = myChar.move;
upsilon.log(`[Bot-${agentIndex}] Character at: ${startPos.x},${startPos.y}, Move credits: ${moveCredits}`);

// 3. Attempt to move with path exceeding available credits
const excessivePath = [];
for (let i = 1; i <= moveCredits + 2; i++) {
    excessivePath.push({ x: startPos.x + i, y: startPos.y });
}

upsilon.log(`[Bot-${agentIndex}] Attempting to move ${excessivePath.length} tiles (have ${moveCredits} credits)...`);
try {
    upsilon.call("game_action", {
        id: matchData.match_id,
        type: "move",
        entity_id: myChar.id,
        target_coords: excessivePath
    });
    upsilon.assert(false, "ERROR: Movement exceeding credits was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Excessive path properly rejected: ${e.message}`);
    upsilon.assertEquals(e.error_key, "entity.path.too.long", "Wrong error key for path too long");
}

// Verify position unchanged
const updatedBoard = upsilon.call("game_state", { id: matchData.match_id });
const updatedChar = updatedBoard.game_state.players.flatMap(p => p.entities).find(e => e.id === myChar.id);
upsilon.assertEquals(updatedChar.position.x, startPos.x, "Character X position changed after failed move");
upsilon.assertEquals(updatedChar.position.y, startPos.y, "Character Y position changed after failed move");
upsilon.log(`[Bot-${agentIndex}] ✅ Position unchanged (${updatedChar.position.x},${updatedChar.position.y})`);

// 4. Attempt valid move within credits
if (moveCredits > 0) {
    const validPath = [{ x: startPos.x + 1, y: startPos.y }];
    upsilon.log(`[Bot-${agentIndex}] Attempting valid 1-tile move...`);
    try {
        upsilon.call("game_action", {
            id: matchData.match_id,
            type: "move",
            entity_id: myChar.id,
            target_coords: validPath
        });
        upsilon.log(`[Bot-${agentIndex}] ✅ Valid move succeeded`);
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] Valid move failed (may be expected): ${e.message}`);
    }
}

upsilon.log(`[Bot-${agentIndex}] EC-04: MOVEMENT PATH TOO LONG PASSED.`);
