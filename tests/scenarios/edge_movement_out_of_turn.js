// upsiloncli/tests/scenarios/edge_movement_out_of_turn.js
// @test-link [[mech_move_validation_move_validation_turn_mismatch]]
// @test-link [[mech_initiative]]
// @test-link [[mech_action_economy]]

const agentCount = 2;
const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "moveoot_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-06: Movement Out of Turn`);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");

if (agentIndex === 0) { upsilon.setShared("match_id", matchData.match_id); }
upsilon.syncGroup("moveoot_ready", agentCount);
const sharedMatchId = upsilon.getShared("match_id");

const myEntity = upsilon.myCharacters()[0];
let rejected = false;
let attempts = 0;

while (!rejected && attempts < 30) {
    attempts++;
    upsilon.sleep(200);
    const state = upsilon.call("game_state", { id: sharedMatchId });
    const bs = state.game_state;
    if (!bs || !bs.current_entity_id) continue;

    if (bs.current_entity_id === myEntity.id) {
        // Our turn: pass so opponent gets initiative back.
        upsilon.call("game_action", { id: sharedMatchId, type: "pass", entity_id: myEntity.id });
        continue;
    }

    // Not our turn: attempt the illegal move.
    try {
        upsilon.call("game_action", {
            id: sharedMatchId,
            type: "move",
            entity_id: myEntity.id,
            target_coords: [{ x: myEntity.position.x + 1, y: myEntity.position.y }]
        });
        upsilon.assert(false, "ERROR: Move out of turn accepted");
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] ✅ Out-of-turn move rejected: ${e.message} (key=${e.error_key})`);
        upsilon.assertEquals(e.error_key, "entity.turn.missmatch", "Expected entity.turn.missmatch");
        rejected = true;
    }
}

upsilon.assert(rejected, "Never observed opponent's turn to attempt out-of-turn move");
upsilon.log(`[Bot-${agentIndex}] EC-06: MOVEMENT OUT OF TURN PASSED.`);
