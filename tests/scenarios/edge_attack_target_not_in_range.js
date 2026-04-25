// upsiloncli/tests/scenarios/edge_attack_target_not_in_range.js
// @test-link [[mech_skill_validation_range_limit_verification]]
// @test-link [[mech_combat_attack_computation]]
// @test-link [[entity_character]]
//
// Pick a coordinate that is provably out of attack reach (the cell diagonally
// across the grid from us) and assert the engine rejects the attack. Avoids
// hard-coded (0,0) which is brittle on different board sizes / spawn rolls.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "notrange_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-13: Attack Target Not in Range`);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVE");

const board = upsilon.waitNextTurn();
if (!board) { upsilon.assert(false, "ERROR: Match ended unexpectedly"); }

const me = upsilon.currentCharacter();
const w = board.grid.width;
const h = board.grid.height;

// Target the cell furthest from us along both axes.
const farX = (me.position.x < w / 2) ? w - 1 : 0;
const farY = (me.position.y < h / 2) ? h - 1 : 0;
const distance = Math.abs(me.position.x - farX) + Math.abs(me.position.y - farY);
upsilon.log(`[Bot-${agentIndex}] Attempting attack at (${farX},${farY}), Manhattan distance ${distance}`);

try {
    upsilon.call("game_action", {
        id: matchData.match_id,
        type: "attack",
        entity_id: me.id,
        target_coords: [{ x: farX, y: farY }]
    });
    upsilon.assert(false, "ERROR: Out-of-range attack accepted by server");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Out-of-range attack rejected: ${e.message} (key=${e.error_key})`);
}

upsilon.log(`[Bot-${agentIndex}] EC-13: ATTACK TARGET NOT IN RANGE PASSED.`);
