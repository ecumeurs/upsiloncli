// upsiloncli/tests/scenarios/edge_leaderboard_invalid_mode.js
// @test-link [[upsilonapi:api_leaderboard]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "lbmode_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-41: Leaderboard Invalid Game Mode`);

// 1. Setup (bootstrapBot also registers an automatic teardown, so no manual
// onTeardown is needed here).
upsilon.bootstrapBot(accountName, password);

// 2. Attempt to fetch the leaderboard with a mode outside the four explicit
// options (1v1_PVP, 2v2_PVP, 1v1_PVE, 2v2_PVE). Every non-member string hits
// the same equality-chain miss in validateLeaderboard() (leaderboard.go), so
// a single representative value is the sharpest edge. "3v3_PVP" is chosen
// over a wholly unrelated string because it is closest in shape to a real
// mode — it proves the check is exact membership, not a loose pattern match.
const invalidMode = "3v3_PVP";

upsilon.log(`[Bot-${agentIndex}] Requesting leaderboard with invalid mode: ${invalidMode}...`);
try {
    upsilon.call("leaderboard", { mode: invalidMode });
    upsilon.assert(false, `ERROR: Invalid leaderboard mode '${invalidMode}' was accepted!`);
} catch (e) {
    // validateLeaderboard() rejects before any battle-service lookup runs:
    // 422 "Validation failed" envelope, with the field-specific reason
    // carried in meta.errors.mode.
    upsilon.assertResponse(e, 422, "Validation failed");
    const fieldErrors = (e.meta && e.meta.errors && e.meta.errors.mode) || [];
    upsilon.assert(
        fieldErrors.includes("The selected mode is invalid."),
        `Expected meta.errors.mode to carry the invalid-mode message, got: ${JSON.stringify(e.meta && e.meta.errors)}`
    );
    upsilon.log(`[Bot-${agentIndex}] ✅ Invalid mode '${invalidMode}' properly rejected: ${e.message}`);
}

upsilon.log(`[Bot-${agentIndex}] EC-41: LEADERBOARD INVALID GAME MODE PASSED.`);
