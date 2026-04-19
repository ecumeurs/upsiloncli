// upsiloncli/tests/scenarios/edge_match_leave_not_queued.js
// @spec-link [[api_matchmaking]]
// @spec-link [[usecase_api_flow_matchmaking]]

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

// 3. Attempt to leave queue when not queued (graceful handling expected)
upsilon.log(`[Bot-${agentIndex}] Attempting to leave queue when not queued...`);
try {
    upsilon.call("matchmaking_leave", {});
    upsilon.log(`[Bot-${agentIndex}] ✅ Leave queue handled gracefully (200 OK or specific error)`);
} catch (e) {
    // May return error, but shouldn't crash
    upsilon.log(`[Bot-${agentIndex}] ✅ Leave queue returned error (acceptable): ${e.message}`);
    // Status code could be 404 Not Found or 409 Conflict, or 200 for idempotent
    if (e.status_code) {
        upsilon.log(`[Bot-${agentIndex}] Status code: ${e.status_code}`);
    }
}

// 4. Verify still idle (no crash or state corruption)
const statusAfterAttempt = upsilon.call("matchmaking_status", {});
upsilon.assertEquals(statusAfterAttempt.status, "idle", "Status should still be 'idle'");
upsilon.log(`[Bot-${agentIndex}] ✅ Status still 'idle' after leave attempt`);

// 5. Join queue and leave (verify normal flow works)
upsilon.log(`[Bot-${agentIndex}] Joining queue...`);
const joinResult = upsilon.call("matchmaking_join", { game_mode: "1v1_PVP" });
upsilon.assertEquals(joinResult.status, "queued", "Join queue should return 'queued'");
upsilon.log(`[Bot-${agentIndex}] ✅ Queue joined: ${joinResult.match_id}`);

upsilon.log(`[Bot-${agentIndex}] Leaving queue normally...`);
upsilon.call("matchmaking_leave", {});

const statusAfterLeave = upsilon.call("matchmaking_status", {});
upsilon.assertEquals(statusAfterLeave.status, "idle", "Status should be 'idle' after leaving");
upsilon.log(`[Bot-${agentIndex}] ✅ Normal leave queue flow works`);

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
