// upsiloncli/tests/scenarios/edge_match_queue_while_queued.js
// @test-link [[rule_matchmaking_single_queue]]
// @test-link [[api_matchmaking]]
// @test-link [[usecase_api_flow_matchmaking]]

const botId = Math.floor(Math.random() * 10000);
const accountName = "queueedge_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log("Starting EC-31: Join Queue While Already in Queue");

// 1. Setup
upsilon.bootstrapBot(accountName, password);

// 2. Join first queue
upsilon.log("Joining 1v1_PVP queue...");
const firstQueueResult = upsilon.call("matchmaking_join", { game_mode: "1v1_PVP" });
upsilon.assertEquals(firstQueueResult.status, "queued", "First queue join should return 'queued'");
upsilon.log(`✅ First queue joined: ${firstQueueResult.match_id}`);

// 3. Attempt to join second queue while already queued (should fail)
upsilon.log("Attempting to join 2v2_PVP while already queued...");
try {
    upsilon.call("matchmaking_join", { game_mode: "2v2_PVP" });
    upsilon.assert(false, "ERROR: Multiple queue joins allowed!");
} catch (e) {
    upsilon.log(`✅ Second queue join properly rejected: ${e.message}`);
    // Verify 409 Conflict status code
    if (e.status_code) {
        upsilon.assertEquals(e.status_code, 409, "Expected 409 Conflict for multiple queue joins");
    }
}

// 4. Verify still in first queue
const statusResult = upsilon.call("matchmaking_status", {});
upsilon.assertEquals(statusResult.status, "queued", "Should still be in queue");
upsilon.log(`✅ Still in first queue: ${statusResult.match_id}`);

// 5. Leave first queue
upsilon.log("Leaving first queue...");
upsilon.call("matchmaking_leave", {});
const statusAfterLeave = upsilon.call("matchmaking_status", {});
upsilon.assertEquals(statusAfterLeave.status, "idle", "Status should be 'idle' after leaving queue");
upsilon.log(`✅ Queue left successfully`);

// 6. Can now join second queue
upsilon.log("Joining 2v2_PVP after leaving first queue...");
const secondQueueResult = upsilon.call("matchmaking_join", { game_mode: "2v2_PVP" });
upsilon.assertEquals(secondQueueResult.status, "queued", "Should be able to queue after leaving");
upsilon.log(`✅ Second queue joined: ${secondQueueResult.match_id}`);

// Cleanup - leave queue before exit
upsilon.onTeardown(() => {
    try {
        upsilon.call("matchmaking_leave", {});
        upsilon.log("✅ Queue left on teardown");
    } catch (e) {
        upsilon.log(`Teardown cleanup error (ignored): ${e.message}`);
    }
    try {
        upsilon.call("auth_delete", {});
    } catch (e) {
        // Ignore cleanup errors
    }
});

upsilon.log("EC-31: JOIN QUEUE WHILE ALREADY QUEUED PASSED.");
