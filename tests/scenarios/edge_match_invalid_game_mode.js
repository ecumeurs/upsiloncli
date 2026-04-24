// upsiloncli/tests/scenarios/edge_match_invalid_game_mode.js
// @test-link [[api_matchmaking]]
// @test-link [[req_matchmaking_matchmaking_queue]]
// @test-link [[spec_match_format]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "invalidmode_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-33: Invalid Game Mode`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);

// 2. Attempt to join queue with invalid game mode
const invalidModes = [
    "3v3_PVP",
    "4v4_PVP",
    "invalid_mode",
    "1v3_PVP"
];

invalidModes.forEach(mode => {
    upsilon.log(`[Bot-${agentIndex}] Attempting to join queue with invalid mode: ${mode}...`);
    try {
        upsilon.call("matchmaking_join", { game_mode: mode });
        upsilon.assert(false, `ERROR: Invalid mode '${mode}' was accepted!`);
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] ✅ Invalid mode '${mode}' properly rejected: ${e.message}`);
        // Verify 400 Bad Request or similar status code
        if (e.status_code) {
            upsilon.assert(e.status_code >= 400 && e.status_code < 500, "Expected 4xx status for invalid mode");
        }
    }
});

// 3. Join queue with valid game mode (should succeed)
const validModes = ["1v1_PVP", "2v2_PVP", "1v1_PVE", "2v2_PVE"];
const validMode = validModes[Math.floor(Math.random() * validModes.length)];

upsilon.log(`[Bot-${agentIndex}] Attempting to join queue with valid mode: ${validMode}...`);
const validQueueResult = upsilon.call("matchmaking_join", { game_mode: validMode });
upsilon.assertEquals(validQueueResult.status, "queued", "Valid mode should return 'queued'");
upsilon.log(`[Bot-${agentIndex}] ✅ Valid mode '${validMode}' accepted`);

// 4. Leave queue
upsilon.log(`[Bot-${agentIndex}] Leaving queue...`);
upsilon.call("matchmaking_leave", {});
const statusAfterLeave = upsilon.call("matchmaking_status", {});
upsilon.assertEquals(statusAfterLeave.status, "idle", "Status should be 'idle' after leaving");
upsilon.log(`[Bot-${agentIndex}] ✅ Queue left successfully`);

// Cleanup
upsilon.onTeardown(() => {
    try {
        upsilon.call("auth_delete", {});
        upsilon.log(`[Bot-${agentIndex}] ✅ Account cleaned up`);
    } catch (e) {
        upsilon.log(`Teardown cleanup error (ignored): ${e.message}`);
    }
});

upsilon.log(`[Bot-${agentIndex}] EC-33: INVALID GAME MODE PASSED.`);
