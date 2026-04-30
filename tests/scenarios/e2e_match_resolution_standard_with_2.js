// upsiloncli/tests/scenarios/e2e_match_resolution_standard.js
// @test-link [[uc_match_resolution]]
// @test-link [[us_win_progression]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "res_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting CR-08: Match Resolution (Standard)`);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");
upsilon.syncGroup("res_start", 2);

function pollProfile(predicate, deadlineMs) {
    const start = Date.now();
    while (Date.now() - start < deadlineMs) {
        const p = upsilon.call("profile_get", {});
        if (predicate(p)) return p;
        upsilon.sleep(250);
    }
    return null;
}

if (agentIndex === 1) {
    upsilon.log("[Bot-1] Forfeiting match to trigger resolution...");
    try {
        upsilon.call("game_forfeit", { id: matchData.match_id });
        upsilon.setContext("match_id", ""); // Clear immediately
        upsilon.log("[Bot-1] Forfeit successful.");
    } catch (e) {
        upsilon.log("[Bot-1] Forfeit failed (possibly already ended): " + JSON.stringify(e));
    }

    const final = pollProfile(p => (p.total_losses || 0) >= 1, 10000);
    upsilon.assert(final !== null, "Loser never recorded a loss");
    upsilon.assertEquals(final.total_losses, 1, "Loser should have exactly 1 loss");
    upsilon.log("[Bot-1] ✅ Loss detected and recorded in profile");
} else {
    upsilon.log("[Bot-0] Waiting for match termination...");
    upsilon.waitNextTurn(); // unblocks on game.ended

    const final = pollProfile(p => (p.total_wins || 0) >= 1, 10000);
    upsilon.assert(final !== null, "Winner never recorded a win");
    upsilon.assertEquals(final.total_wins, 1, "Winner should have exactly 1 win");
    upsilon.log("[Bot-0] ✅ Win detected and recorded in profile");
}

upsilon.log(`[Bot-${agentIndex}] CR-08: MATCH RESOLUTION (STANDARD) PASSED.`);
