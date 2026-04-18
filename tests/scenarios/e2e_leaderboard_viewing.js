// upsiloncli/tests/scenarios/e2e_leaderboard_viewing.js
// @spec-link [[us_leaderboard_view]]
// @spec-link [[api_leaderboard]]

const botId = Math.floor(Math.random() * 10000);
const accountName = "leader_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log("Starting CR-12: Leaderboard Viewing for " + accountName);

// 1. Setup: Register & Login
upsilon.bootstrapBot(accountName, password);

// 2. Access leaderboard
upsilon.log("Requesting leaderboard for 1v1_PVP...");
const leaderboard = upsilon.call("leaderboard_index", { game_mode: "1v1_PVP" });

// 3. Validation Points
upsilon.assert(Array.isArray(leaderboard), "Leaderboard should be an array");
upsilon.log(`✅ Leaderboard received with ${leaderboard.length} entries`);

if (leaderboard.length > 0) {
    const topPlayer = leaderboard[0];
    upsilon.assert(topPlayer.nickname != null, "Entry should have a nickname");
    upsilon.assert(topPlayer.score != null, "Entry should have a score");
    upsilon.log(`✅ Top player: ${topPlayer.nickname} (Score: ${topPlayer.score})`);
}

upsilon.log("CR-12: LEADERBOARD VIEWING PASSED.");
