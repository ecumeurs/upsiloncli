// upsiloncli/tests/scenarios/e2e_progression_constraints.js
// @test-link [[rule_progression]]
// @test-link [[uc_progression_stat_allocation]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const Role = agentIndex === 0 ? "WINNER" : "LOSER";
const accountName = `prog_bot_${botId}`;
const password = "VerySecurePassword123!";

upsilon.log(`[${Role}] Starting CR-11: Progression Constraints`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);

if (Role === "WINNER") {
    const profile = upsilon.call("profile_get", {});
    const charId = profile.characters[0].id;

    // 2. Pre-Win Upgrade Lock Validation
    upsilon.log("[WINNER] Testing Pre-Win Upgrade Lock...");
    try {
        upsilon.call("character_upgrade", {
            characterId: charId,
            hp: 1
        });
        upsilon.assert(false, "ERROR: Character allowed to upgrade before winning any matches!");
    } catch (e) {
        upsilon.log("✅ Pre-Win upgrade properly rejected: " + e.message);
    }
}

// 3. Matchmaking & Resolution (Winner get +1 point)
const matchData = upsilon.joinWaitMatch("1v1_PVP");
upsilon.syncGroup("prog_match", 2);

if (Role === "LOSER") {
    upsilon.log("[LOSER] Forfeiting...");
    upsilon.call("game_forfeit", { id: matchData.match_id });
} else {
    upsilon.log("[WINNER] Waiting for game end...");
    upsilon.waitNextTurn(); // Wait for match to close
    upsilon.sleep(2000); // Wait for background progression task

    const profile = upsilon.call("profile_get", {});
    const char = profile.characters[0];
    upsilon.log(`[WINNER] Won! Current total stats: ${char.hp + char.attack + char.defense + char.movement}`);

    // 4. Valid HP Upgrade
    upsilon.log("[WINNER] Testing valid HP upgrade...");
    const upgraded = upsilon.call("character_upgrade", {
        characterId: char.id,
        hp: 1
    });
    upsilon.assertEquals(upgraded.hp, char.hp + 1, "HP upgrade failed!");
    upsilon.log("✅ HP upgrade successful");

    // 5. Illegal Upgrade (Cap: 10 + 1 = 11)
    upsilon.log("[WINNER] Testing attribute cap (11/11 reached)...");
    try {
        upsilon.call("character_upgrade", {
            characterId: char.id,
            attack: 1
        });
        upsilon.assert(false, "ERROR: Upgrade allowed beyond cap (10+wins)!");
    } catch (e) {
        upsilon.log("✅ Upgrade beyond cap properly rejected: " + e.message);
    }

    // 6. Illegal Movement Gate (Next allowed at 5 wins)
    upsilon.log("[WINNER] Testing movement gate (1 every 5 wins)...");
    try {
        upsilon.call("character_upgrade", {
            characterId: char.id,
            movement: 1
        });
        upsilon.assert(false, "ERROR: Movement upgrade allowed before 5 wins milestone!");
    } catch (e) {
        upsilon.log("✅ Movement gate properly enforced: " + e.message);
    }
}

upsilon.log(`[${Role}] CR-11: PROGRESSION CONSTRAINTS PASSED.`);
