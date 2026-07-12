// upsiloncli/tests/scenarios/edge_match_leave_not_queued.js
// @test-link [[api_matchmaking]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "leaveq_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-34: Leave Queue Not Queued`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);

// 2. Verify initial status is idle
const initialStatus = upsilon.call("matchmaking_status", {});
upsilon.assertEquals(initialStatus.status, "idle", "Initial status should be 'idle'");
upsilon.log(`[Bot-${agentIndex}] Initial status: ${initialStatus.status}`);

// 3. Leave the queue while not queued. LeaveQueue (pg.go) is an unconditional
// DELETE over the caller's queue rows with no existence check, so this is
// idempotent and must succeed exactly like a normal leave (no try/catch —
// an unexpected error here is a real regression, not an "acceptable" outcome).
upsilon.log(`[Bot-${agentIndex}] Leaving queue while not queued...`);
upsilon.call("matchmaking_leave", {});
upsilon.log(`[Bot-${agentIndex}] ✅ Leave-when-not-queued accepted without error`);

// 4. Verify still idle (no crash or state corruption)
const statusAfterAttempt = upsilon.call("matchmaking_status", {});
upsilon.assertEquals(statusAfterAttempt.status, "idle", "Status should still be 'idle'");
upsilon.log(`[Bot-${agentIndex}] ✅ Status still 'idle' after leave attempt`);

// Cleanup
upsilon.onTeardown(() => {
    try {
        upsilon.call("matchmaking_leave", {});  // Ensure queue is left
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

upsilon.log(`[Bot-${agentIndex}] EC-34: LEAVE QUEUE NOT QUEUED PASSED.`);
