// upsiloncli/tests/scenarios/e2e_match_resolution_standard.js
// @spec-link [[uc_match_resolution]]
// @spec-link [[us_win_progression]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "res_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting CR-08: Match Resolution (Standard)`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");
upsilon.syncGroup("res_start", 2);

if (agentIndex === 1) {
    // Bot 1 acts as the loser to accelerate the test
    upsilon.log("[Bot-1] Forfeiting match to trigger resolution...");
    upsilon.call("game_forfeit", { id: matchData.match_id });

    // Wait for backend to process state as webhook arrives async
    upsilon.sleep(3000);
    
    const profile = upsilon.call("profile_get", {});
    upsilon.assertEquals(profile.total_losses, 1, "Loser should have exactly 1 loss");
    upsilon.log("[Bot-1] ✅ Loss detected and recorded in profile");
} else {
    // Bot 0 waits for victory
    upsilon.log("[Bot-0] Waiting for match victory...");
    upsilon.waitNextTurn(); // Blocks until board.updated (won) or game.ended
    
    // We check results after match termination
    upsilon.sleep(3000); // Wait for backend to process progression
    
    const profile = upsilon.call("profile_get", {});
    upsilon.assertEquals(profile.total_wins, 1, "Winner should have exactly 1 win");
    upsilon.log("[Bot-0] ✅ Win detected and recorded in profile");
    
    // Check progression reward
    // Winner should have 1 point available for allocation
}

upsilon.log(`[Bot-${agentIndex}] CR-08: MATCH RESOLUTION (STANDARD) PASSED.`);
