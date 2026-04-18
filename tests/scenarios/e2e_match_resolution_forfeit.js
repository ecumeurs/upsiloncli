// upsiloncli/tests/scenarios/e2e_match_resolution_forfeit.js
// @spec-link [[uc_match_resolution]]
// @spec-link [[rule_forfeit_battle]]

const botId = Math.floor(Math.random() * 10000);
const accountName = "forfeit_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log("Starting CR-09: Match Resolution (Forfeit) for " + accountName);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVE");

// 2. Player chooses to forfeit
upsilon.log("Forfeiting match immediately...");
upsilon.call("game_forfeit", { id: matchData.match_id });

// 3. System processes forfeit immediately
upsilon.log("✅ Forfeit command sent");

// 4. Verification: End match detected
// (The bootstrapBot teardown will handle the final status check if it runs again, 
// but here we manually verify the match concluded)
upsilon.sleep(1000);
const profile = upsilon.call("profile_get", {});
upsilon.assertEquals(profile.total_losses, 1, "Should have 1 loss after forfeiting");
upsilon.log("✅ Loss recorded correctly in profile");

upsilon.log("CR-09: MATCH RESOLUTION (FORFEIT) PASSED.");
