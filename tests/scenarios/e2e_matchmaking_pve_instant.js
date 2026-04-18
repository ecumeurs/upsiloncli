// upsiloncli/tests/scenarios/e2e_matchmaking_pve_instant.js
// @spec-link [[uc_matchmaking]]
// @spec-link [[us_queue_selection]]

const botId = Math.floor(Math.random() * 10000);
const accountName = "pve_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log("Starting CR-04: Matchmaking Flow (PvE Instant) for " + accountName);

// 1. Setup: Register & Login
upsilon.bootstrapBot(accountName, password);

// 2. Player selection PvE mode and joins queue
upsilon.log("Joining PvE queue (Instant)...");
const matchData = upsilon.joinWaitMatch("1v1_PVE");

// 3. System instantly starts match against AI
upsilon.log("✅ Match Found! ID: " + matchData.match_id);
upsilon.assertEquals(matchData.game_mode, "1v1_PVE", "Should be in PvE mode");

// 4. Verify arena entry and turn management
upsilon.log("Waiting for my turn in PvE arena...");
const board = upsilon.waitNextTurn();
upsilon.assert(board != null, "Should have received initial board state");
upsilon.log("✅ Successfully entered battle arena");

// 5. Check AI opponent
const foes = upsilon.myFoes();
upsilon.assert(foes.length > 0, "No AI opponent found in PvE match");
upsilon.log(`✅ AI Opponent detected: ${foes[0].nickname}`);

// Match termination is handled by bootstrapBot teardown
upsilon.log("CR-04: MATCHMAKING FLOW (PVE INSTANT) PASSED.");
