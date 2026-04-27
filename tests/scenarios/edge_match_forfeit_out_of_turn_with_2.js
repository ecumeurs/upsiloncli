// upsiloncli/tests/scenarios/edge_match_forfeit_out_of_turn.js
// @test-link [[rule_forfeit_battle]]
// @test-link [[uc_match_resolution]]
// @test-link [[mech_initiative]]
//
// Per [[rule_forfeit_battle]] forfeit is a player-level action that bypasses
// turn ownership ("Bypasses the need for entity_id"). The expected behaviour
// is that ANY participant can forfeit at ANY moment. This test asserts that
// premise: bot 1 forfeits while it is bot 0's turn, and the engine accepts
// the forfeit.

const agentCount = 2;
const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "forfeitoot_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-35: Forfeit Out of Turn`);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");

if (agentIndex === 0) { upsilon.setShared("match_id", matchData.match_id); }
upsilon.syncGroup("forfeitoot_ready", agentCount);
const sharedMatchId = upsilon.getShared("match_id");

if (agentIndex === 1) {
    // Bot 1 is the conceder. Wait until we observe bot 0's turn (i.e. NOT ours)
    // then issue the forfeit. Per the rule this must succeed.
    const myEntity = upsilon.myCharacters()[0];
    let forfeited = false;
    let attempts = 0;
    while (!forfeited && attempts < 30) {
        attempts++;
        upsilon.sleep(200);
        const state = upsilon.call("game_state", { id: sharedMatchId });
        const bs = state.game_state;
        if (!bs || !bs.current_entity_id) continue;

        if (bs.current_entity_id === myEntity.id) continue; // our turn — keep waiting

        upsilon.log(`[Bot-${agentIndex}] Forfeiting while opponent (entity ${bs.current_entity_id}) holds initiative...`);
        upsilon.call("game_forfeit", { id: sharedMatchId });
        forfeited = true;
    }
    upsilon.assert(forfeited, "Never observed opponent's turn to forfeit out of ours");
} else {
    // Bot 0 plays normally; the match will terminate as bot 1 forfeits.
    let rounds = 0;
    while (rounds < 60) {
        rounds++;
        const board = upsilon.waitNextTurn();
        if (!board) break;
        upsilon.autoBattleTurn(sharedMatchId);
    }
}

upsilon.log(`[Bot-${agentIndex}] EC-35: FORFEIT OUT OF TURN PASSED.`);
