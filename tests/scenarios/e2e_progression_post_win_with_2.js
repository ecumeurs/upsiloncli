// upsiloncli/tests/scenarios/e2e_progression_post_win.js
// @test-link [[uc_progression_stat_allocation]]
// @test-link [[us_win_progression_win_alloc_point]]
// @test-link [[rule_progression]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const Role = agentIndex === 0 ? "WINNER" : "LOSER";
const accountName = `prog_win_bot_${botId}`;
const password = "VerySecurePassword123!";

upsilon.log(`[${Role}] Starting CR-10: Character Progression (Post-Win)`);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");
upsilon.syncGroup("prog_post_win", 2);

if (Role === "LOSER") {
    upsilon.call("game_forfeit", { id: matchData.match_id });
} else {
    upsilon.waitNextTurn();
    upsilon.sleep(2000);

    const profile = upsilon.call("profile_get", {});
    const char = profile.characters[0];
    
    upsilon.log("[WINNER] Allocating win point to attack...");
    const upgraded = upsilon.call("character_upgrade", {
        characterId: char.id,
        attack: 1
    });
    
    upsilon.assertEquals(upgraded.attack, char.attack + 1, "Attack should be incremented");
    upsilon.log("✅ Point allocated and reflected in stats");
}

upsilon.log(`[${Role}] CR-10: CHARACTER PROGRESSION (POST-WIN) PASSED.`);
