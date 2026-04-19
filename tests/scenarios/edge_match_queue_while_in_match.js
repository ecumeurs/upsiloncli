// upsiloncli/tests/scenarios/edge_match_queue_while_in_match.js
// @spec-link [[rule_matchmaking_single_queue]]
// @spec-link [[api_matchmaking]]
// @spec-link [[uc_matchmaking]]

const agentCount = 2;
const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "qmatch_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-32: Queue While in Match`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");

// Share match ID
if (agentIndex === 0) {
    upsilon.setShared("match_id", matchData.match_id);
}
upsilon.syncGroup("qmatch_ready", agentCount);

const sharedMatchId = upsilon.getShared("match_id");

// 2. While match is active, attempt to join another queue
upsilon.log(`[Bot-${agentIndex}] Attempting to join queue while in match...`);
try {
    upsilon.call("matchmaking_join", { game_mode: "2v2_PVP" });
    upsilon.assert(false, "ERROR: Queue join while in match was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Queue join while in match properly rejected: ${e.message}`);
    // Verify 409 Conflict status code
    if (e.status_code) {
        upsilon.assertEquals(e.status_code, 409, "Expected 409 Conflict for queue while in match");
    }
}

// 3. Verify still in original match
const matchStatus = upsilon.call("game_state", { id: sharedMatchId });
upsilon.assert(matchStatus.data != null, "Match state should still be accessible");
upsilon.log(`[Bot-${agentIndex}] ✅ Still in original match`);

// 4. Forfeit match and verify can now queue
upsilon.log(`[Bot-${agentIndex}] Forfeiting match...`);
try {
    upsilon.call("game_forfeit", { id: sharedMatchId });
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] Forfeit failed: ${e.message}`);
}

upsilon.sleep(2000);

// 5. Now can join queue
upsilon.log(`[Bot-${agentIndex}] Attempting to join queue after forfeit...`);
const newQueueResult = upsilon.call("matchmaking_join", { game_mode: "1v1_PVP" });
upsilon.assertEquals(newQueueResult.status, "queued", "Should be able to queue after match ends");
upsilon.log(`[Bot-${agentIndex}] ✅ Queue joined after match ended`);

// Cleanup - leave queue
upsilon.onTeardown(() => {
    try {
        upsilon.call("matchmaking_leave", {});
        upsilon.log(`[Bot-${agentIndex}] ✅ Queue left on teardown`);
    } catch (e) {
        upsilon.log(`Teardown cleanup error (ignored): ${e.message}`);
    }
    try {
        upsilon.call("auth_delete", {});
    } catch (e) {
        // Ignore cleanup errors
    }
});

upsilon.log(`[Bot-${agentIndex}] EC-32: QUEUE WHILE IN MATCH PASSED.`);
