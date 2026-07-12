// upsiloncli/tests/scenarios/edge_match_queue_while_in_match_with_2.js
// @test-link [[rule_matchmaking_single_queue]]
// @test-link [[api_matchmaking]]
// @test-link [[uc_matchmaking]]

const agentCount = 2;
const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "qmatch_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-32: Queue While in Match`);

// 1. Setup — both bots queue for 1v1_PVP, which immediately matches them
// against each other. bootstrapBot's automatic teardown already leaves any
// queue, forfeits the still-active match (match_id stays set in context
// since we never call jsWaitNextTurn/forfeit below) and deletes the
// account, so no manual onTeardown is needed here.
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");

// Share match ID
if (agentIndex === 0) {
    upsilon.setShared("match_id", matchData.match_id);
}
upsilon.syncGroup("qmatch_ready", agentCount);

const sharedMatchId = upsilon.getShared("match_id");

// 2. While the match is active, attempt to join another queue. This is the
// specific edge of rule_matchmaking_single_queue rule #2 — "MUST NOT be
// permitted to join a matchmaking queue if they are currently an active
// participant in an un-concluded match" — distinct from the sibling
// edge_match_queue_while_queued scenario, which covers rule #1 (already
// queued, no match yet).
upsilon.log(`[Bot-${agentIndex}] Attempting to join queue while in match...`);
try {
    upsilon.call("matchmaking_join", { game_mode: "2v2_PVP" });
    upsilon.assert(false, "ERROR: Queue join while in match was accepted!");
} catch (e) {
    // Rule #3: MUST return 409 Conflict with a descriptive message — the
    // handler's ErrInActiveMatch branch (upsilonhub/internal/gateway/matchmaking.go).
    // Strict status + exact message match, not just "any error thrown".
    upsilon.assertResponse(e, 409, "Conflict: You are currently participating in an active match.");
    upsilon.log(`[Bot-${agentIndex}] ✅ Queue join while in match properly rejected: ${e.message}`);
}

// 3. Verify still in the original match (the rejection didn't disturb state).
// upsilon.call() unwraps the API envelope and returns the `data` field directly,
// so matchStatus is the data object (not {data: ...}).
const matchStatus = upsilon.call("game_state", { id: sharedMatchId });
upsilon.assert(matchStatus != null && matchStatus.match_id != null, "Match state should still be accessible");
upsilon.log(`[Bot-${agentIndex}] ✅ Still in original match`);

upsilon.log(`[Bot-${agentIndex}] EC-32: QUEUE WHILE IN MATCH PASSED.`);
