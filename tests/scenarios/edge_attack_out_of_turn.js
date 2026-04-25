// upsiloncli/tests/scenarios/edge_attack_out_of_turn.js
// @test-link [[mech_skill_validation_turn_controller_identity_verification]]
// @test-link [[mech_initiative]]
// @test-link [[mech_action_economy]]
//
// Strategy: two bots share a match ID. The "attacker" bot grabs its own
// entity id via myCharacters() and, while it is NOT its turn, tries to attack.
// waitNextTurn() only returns when it IS our turn, so we inspect the last
// known board BEFORE waiting. If the board shows current_entity_id != ours,
// we fire the illegal attack and expect entity.turn.missmatch.

const agentCount = 2;
const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "attackoot_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-10: Attack Out of Turn`);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");

if (agentIndex === 0) {
    upsilon.setShared("match_id", matchData.match_id);
}
upsilon.syncGroup("attackoot_ready", agentCount);
const sharedMatchId = upsilon.getShared("match_id");
upsilon.assertEquals(sharedMatchId, matchData.match_id, "Shared match ID mismatch");

// Let the first board.updated land so both sides know whose turn it is.
// We peek at the session rather than waitNextTurn(), which blocks.
const myEntity = upsilon.myCharacters()[0];
let rejected = false;
let attempts = 0;

while (!rejected && attempts < 30) {
    attempts++;
    upsilon.sleep(200); // let engine emit the first board update

    // Poll game_state directly: if currently it's NOT our entity's turn,
    // attempt the illegal attack.
    const state = upsilon.call("game_state", { id: sharedMatchId });
    const bs = state.game_state;
    if (!bs || !bs.current_entity_id) continue;

    const foes = bs.players
        .filter(p => p.entities.some(e => e.id !== myEntity.id))
        .flatMap(p => p.entities.filter(e => e.id !== myEntity.id && e.hp > 0));
    if (foes.length === 0) continue;

    if (bs.current_entity_id === myEntity.id) {
        // It's our turn — pass to give initiative back to the opponent.
        upsilon.call("game_action", { id: sharedMatchId, type: "pass", entity_id: myEntity.id });
        continue;
    }

    // Opponent's turn → attempt illegal attack.
    try {
        upsilon.call("game_action", {
            id: sharedMatchId,
            type: "attack",
            entity_id: myEntity.id,
            target_coords: [foes[0].position]
        });
        upsilon.assert(false, "ERROR: Out-of-turn attack accepted");
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] ✅ Out-of-turn attack rejected: ${e.message} (key=${e.error_key})`);
        upsilon.assertEquals(e.error_key, "entity.turn.missmatch", "Expected entity.turn.missmatch");
        rejected = true;
    }
}

upsilon.assert(rejected, "Never observed opponent's turn to attempt out-of-turn attack");
upsilon.log(`[Bot-${agentIndex}] EC-10: ATTACK OUT OF TURN PASSED.`);
