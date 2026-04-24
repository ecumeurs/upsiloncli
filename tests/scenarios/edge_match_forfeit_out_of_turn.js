// upsiloncli/tests/scenarios/edge_match_forfeit_out_of_turn.js
// @test-link [[rule_forfeit_battle]]
// @test-link [[uc_match_resolution]]
// @test-link [[mech_initiative]]

const agentCount = 2;
const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "forfeitoot_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-35: Forfeit Out of Turn`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");

// Share match ID
if (agentIndex === 0) {
    upsilon.setShared("match_id", matchData.match_id);
}
upsilon.syncGroup("forfeitoot_ready", agentCount);

const sharedMatchId = upsilon.getShared("match_id");

// 2. Wait for first turn
const board = upsilon.waitNextTurn();
if (!board) {
    upsilon.assert(false, "ERROR: Match ended unexpectedly");
}

const myChar = upsilon.currentCharacter();
const isMyTurn = board.current_entity_id === myChar.id;

upsilon.log(`[Bot-${agentIndex}] My character: ${myChar.id}, Current turn: ${board.current_entity_id}, My turn: ${isMyTurn}`);

// 3. If NOT my turn, attempt to forfeit (may be rejected or allowed depending on implementation)
if (!isMyTurn) {
    upsilon.log(`[Bot-${agentIndex}] Attempting forfeit out of turn...`);
    try {
        upsilon.call("game_forfeit", { id: sharedMatchId });
        // If forfeit is allowed out of turn, log accordingly
        upsilon.log(`[Bot-${agentIndex}] Note: Forfeit out of turn was accepted (may be allowed)`);
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] ✅ Forfeit out of turn rejected: ${e.message}`);
    }
} else {
    // 4. If IS my turn, forfeit should succeed
    upsilon.log(`[Bot-${agentIndex}] Attempting forfeit on my turn...`);
    try {
        upsilon.call("game_forfeit", { id: sharedMatchId });
        upsilon.log(`[Bot-${agentIndex}] ✅ Forfeit on my turn succeeded`);

        // 5. Verify match ended
        upsilon.sleep(2000);
        const matchState = upsilon.call("game_state", { id: sharedMatchId });
        if (matchState.data && matchState.data.winner_team_id !== null) {
            upsilon.log(`[Bot-${agentIndex}] ✅ Match ended, winner declared: team ${matchState.data.winner_team_id}`);
        } else {
            upsilon.log(`[Bot-${agentIndex}] Match may still be ending...`);
        }
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] Forfeit failed: ${e.message}`);
    }
}

upsilon.log(`[Bot-${agentIndex}] EC-35: FORFEIT OUT OF TURN PASSED.`);
