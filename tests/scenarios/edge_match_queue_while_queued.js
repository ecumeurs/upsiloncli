// upsiloncli/tests/scenarios/edge_match_queue_while_queued.js
// @test-link [[upsilonapi:rule_matchmaking_single_queue]]
// @test-link [[upsilonapi:api_matchmaking]]

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

// 3. Attempt to join a second, different-mode queue while already queued —
// [[upsilonapi:rule_matchmaking_single_queue]] clause 1: a player MUST NOT
// be permitted to join ANY queue while they already have an active entry.
// The success/failure verdict is asserted outside the try/catch so an
// unexpected success (no throw at all) can't be silently swallowed by this
// same catch block.
upsilon.log("Attempting to join 2v2_PVP while already queued...");
let rejected = false;
try {
    upsilon.call("matchmaking_join", { game_mode: "2v2_PVP" });
} catch (e) {
    rejected = true;
    upsilon.assertResponse(e, 409, "Conflict: You are already in a matchmaking queue.");
    upsilon.log(`✅ Second queue join properly rejected: ${e.message}`);
}
upsilon.assert(rejected, "ERROR: Multiple queue joins allowed!");

// 4. Verify the rejected attempt left the original queue entry untouched.
const statusResult = upsilon.call("matchmaking_status", {});
upsilon.assertEquals(statusResult.status, "queued", "Should still be in queue");
upsilon.log(`✅ Still in first queue: ${statusResult.match_id}`);

// Cleanup (leave queue + delete account) is handled by bootstrapBot's
// automatic teardown — no manual onTeardown needed.

upsilon.log("EC-31: JOIN QUEUE WHILE ALREADY QUEUED PASSED.");
