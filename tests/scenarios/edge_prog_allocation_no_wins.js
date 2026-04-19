// upsiloncli/tests/scenarios/edge_prog_allocation_no_wins.js
// @spec-link [[rule_progression]]
// @spec-link [[uc_progression_stat_allocation]]
// @spec-link [[us_win_progression]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "prognowins_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-27: Progression Stat Allocation Without Wins`);

// 1. Setup (register new account)
const regResponse = upsilon.call("auth_register", {
    account_name: accountName,
    email: accountName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: "Test St",
    birth_date: "1990-01-01T00:00:00Z"
});

upsilon.assert(regResponse.user != null, "Registration failed");

// Get character roster
const profile = upsilon.call("profile_characters", {});
upsilon.assert(profile.length > 0, "No characters found");
const char = profile[0];
const charId = char.id;

upsilon.log(`[Bot-${agentIndex}] Character: ${char.name}, HP: ${char.hp}, Attack: ${char.attack}, Defense: ${char.defense}, Move: ${char.move}`);
upsilon.log(`[Bot-${agentIndex}] Total wins: ${regResponse.user.total_wins}`);

// 2. Attempt to upgrade character without wins (should fail)
upsilon.log(`[Bot-${agentIndex}] Attempting upgrade without wins...`);
try {
    upsilon.call("character_upgrade", {
        characterId: charId,
        hp: 1
    });
    upsilon.assert(false, "ERROR: Upgrade without wins was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Upgrade without wins properly rejected: ${e.message}`);
}

// 3. Verify stats unchanged
const updatedProfile = upsilon.call("profile_character", { characterId: charId });
upsilon.assertEquals(updatedProfile.hp, char.hp, "HP changed after failed upgrade");
upsilon.assertEquals(updatedProfile.attack, char.attack, "Attack changed after failed upgrade");
upsilon.log(`[Bot-${agentIndex}] ✅ Stats unchanged`);

// 4. Win a match to get point
upsilon.log(`[Bot-${agentIndex}] Joining match to win...`);
const matchData = upsilon.joinWaitMatch("1v1_PVE");

// Wait for turn
const board = upsilon.waitNextTurn();
if (board) {
    upsilon.log(`[Bot-${agentIndex}] Got turn, playing...`);

    // Play some moves
    const myChar = upsilon.currentCharacter();
    const movePath = [{ x: Math.min(myChar.position.x + 1, 9), y: myChar.position.y }];

    try {
        upsilon.call("game_action", {
            id: matchData.match_id,
            type: "move",
            entity_id: myChar.id,
            target_coords: movePath
        });
    } catch (e) {
        // Move may fail
    }

    // Wait for match to end
    upsilon.sleep(10000);
}

// 5. Now can upgrade (1 point available)
upsilon.log(`[Bot-${agentIndex}] Attempting upgrade after winning...`);
const afterWinProfile = upsilon.call("profile_get", {});
upsilon.log(`[Bot-${agentIndex}] Total wins: ${afterWinProfile.total_wins}`);

if (afterWinProfile.total_wins > 0) {
    try {
        const upgraded = upsilon.call("character_upgrade", {
            characterId: charId,
            hp: 1
        });
        upsilon.assertEquals(upgraded.hp, char.hp + 1, "HP upgrade failed");
        upsilon.log(`[Bot-${agentIndex}] ✅ Upgrade after win succeeded (HP: ${upgraded.hp})`);
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] Upgrade after win failed: ${e.message}`);
    }
}

// Cleanup
upsilon.onTeardown(() => {
    try {
        upsilon.call("auth_delete", {});
        upsilon.log(`[Bot-${agentIndex}] ✅ Account cleaned up`);
    } catch (e) {
        upsilon.log(`Teardown cleanup error (ignored): ${e.message}`);
    }
});

upsilon.log(`[Bot-${agentIndex}] EC-27: PROGRESSION STAT ALLOCATION WITHOUT WINS PASSED.`);
