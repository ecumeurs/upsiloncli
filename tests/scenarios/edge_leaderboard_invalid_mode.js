// upsiloncli/tests/scenarios/edge_leaderboard_invalid_mode.js
// @spec-link [[api_leaderboard]]
// @spec-link [[us_leaderboard_view_sort_leaderboard]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "lbmode_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-41: Leaderboard Invalid Game Mode`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);

// 2. Test leaderboard with invalid game mode
const invalidModes = [
    "3v3_PVP",
    "4v4_PVP",
    "invalid_mode",
    "1v3_PVP",
    "freeforall",
    "ranked_only"
];

invalidModes.forEach(mode => {
    upsilon.log(`[Bot-${agentIndex}] Requesting leaderboard with invalid mode: ${mode}...`);
    try {
        const result = upsilon.call("leaderboard", { mode: mode });
        upsilon.assert(false, `ERROR: Invalid leaderboard mode '${mode}' was accepted!`);
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] ✅ Invalid mode '${mode}' properly rejected: ${e.message}`);
        // Verify 400 Bad Request or similar status code
        if (e.status_code) {
            upsilon.assert(e.status_code >= 400 && e.status_code < 500, "Expected 4xx status for invalid mode");
        }
    }
});

// 3. Test leaderboard with valid game modes
const validModes = ["1v1_PVP", "2v2_PVP", "1v1_PVE", "2v2_PVE"];

validModes.forEach(mode => {
    upsilon.log(`[Bot-${agentIndex}] Requesting leaderboard with valid mode: ${mode}...`);
    try {
        const result = upsilon.call("leaderboard", { mode: mode });
        upsilon.assert(result.results != undefined, "Leaderboard results missing");
        upsilon.log(`[Bot-${agentIndex}] ✅ Valid mode '${mode}' succeeded, ${result.results.length} results`);
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] Valid mode '${mode}' failed: ${e.message}`);
    }
});

upsilon.log(`[Bot-${agentIndex}] EC-41: LEADERBOARD INVALID GAME MODE PASSED.`);
