// upsiloncli/tests/scenarios/e2e_match_resolution_forfeit.js
// @test-link [[uc_match_resolution]]
// @test-link [[rule_forfeit_battle]]

const botId = Math.floor(Math.random() * 10000);
const accountName = "forfeit_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log("Starting CR-09: Match Resolution (Forfeit) for " + accountName);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVE");

// 1. Forfeit immediately.
upsilon.log("Forfeiting match immediately...");
upsilon.call("game_forfeit", { id: matchData.match_id });
upsilon.log("✅ Forfeit command sent");

// 2. The webhook → Laravel post-match progression is asynchronous; instead of
// a fixed sleep we poll profile_get for the loss to land. Bound it to keep the
// test from hanging when the engine is wedged.
let lossesObserved = 0;
const DEADLINE_MS = 8000;
const POLL_MS = 250;
const start = Date.now();
while (Date.now() - start < DEADLINE_MS) {
    const profile = upsilon.call("profile_get", {});
    if ((profile.total_losses || 0) >= 1) {
        lossesObserved = profile.total_losses;
        break;
    }
    upsilon.sleep(POLL_MS);
}

upsilon.assertEquals(lossesObserved, 1, "Should have 1 loss after forfeiting (poll exhausted)");
upsilon.log("✅ Loss recorded correctly in profile");

upsilon.log("CR-09: MATCH RESOLUTION (FORFEIT) PASSED.");
