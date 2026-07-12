// upsiloncli/tests/scenarios/edge_match_invalid_game_mode.js
// @test-link [[shared:req_matchmaking]]
// @test-link [[upsilonapi:api_matchmaking]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "invalidmode_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-33: Invalid Game Mode`);

// 1. Setup (bootstrapBot also registers an automatic teardown that leaves any
// queue and deletes the account, so no manual onTeardown is needed here).
upsilon.bootstrapBot(accountName, password);

// 2. Attempt to join with a mode outside the four explicit options
// (1v1_PVP, 1v1_PVE, 2v2_PVP, 2v2_PVE — [[shared:req_matchmaking]]). Every
// non-member string hits the same `slices.Contains` membership check in
// `validateJoin` (upsilonhub/internal/gateway/matchmaking.go), so a single
// representative value is the sharpest edge. "1v3_PVP" is chosen over a
// wholly unrelated string because it is closest in shape to a real mode —
// it proves the check is exact membership, not a loose pattern match.
const invalidMode = "1v3_PVP";

upsilon.log(`[Bot-${agentIndex}] Attempting to join queue with invalid mode: ${invalidMode}...`);
try {
    upsilon.call("matchmaking_join", { game_mode: invalidMode });
    upsilon.assert(false, `ERROR: Invalid mode '${invalidMode}' was accepted!`);
} catch (e) {
    // The handler's validateJoin() rejects before any queue/matchmaker logic
    // runs: 422 "Validation failed" envelope, with the field-specific reason
    // carried in meta.errors.game_mode.
    upsilon.assertResponse(e, 422, "Validation failed");
    const fieldErrors = (e.meta && e.meta.errors && e.meta.errors.game_mode) || [];
    upsilon.assert(
        fieldErrors.includes("The selected game mode is invalid."),
        `Expected meta.errors.game_mode to carry the invalid-mode message, got: ${JSON.stringify(e.meta && e.meta.errors)}`
    );
    upsilon.log(`[Bot-${agentIndex}] ✅ Invalid mode '${invalidMode}' properly rejected: ${e.message}`);
}

upsilon.log(`[Bot-${agentIndex}] EC-33: INVALID GAME MODE PASSED.`);
