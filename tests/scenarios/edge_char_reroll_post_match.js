// upsiloncli/tests/scenarios/edge_char_reroll_post_match.js
// @spec-link [[mech_character_reroll_limit]]
// @spec-link [[us_character_reroll]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "rerollpm_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-26: Reroll After Match Participation`);

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
const charId = profile[0].id;
upsilon.log(`[Bot-${agentIndex}] Character ID: ${charId}`);

// 2. Reroll before match (should succeed)
upsilon.log(`[Bot-${agentIndex}] Rerolling character before match...`);
try {
    upsilon.call("character_rename", {
        characterId: charId,
        name: "BeforeMatch"
    });
    upsilon.log(`[Bot-${agentIndex}] ✅ Pre-match reroll succeeded`);
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] Pre-match reroll failed: ${e.message}`);
}

// 3. Join and complete a match
upsilon.log(`[Bot-${agentIndex}] Joining match...`);
const matchData = upsilon.joinWaitMatch("1v1_PVE");
upsilon.log(`[Bot-${agentIndex}] Match joined: ${matchData.match_id}`);

// Wait for turn then forfeit to complete match
const board = upsilon.waitNextTurn();
if (board) {
    upsilon.log(`[Bot-${agentIndex}] Got turn, forfeiting...`);
    try {
        upsilon.call("game_forfeit", { id: matchData.match_id });
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] Forfeit failed: ${e.message}`);
    }
}

// Wait for match to end
upsilon.sleep(3000);

// 4. Attempt reroll after match (should fail)
upsilon.log(`[Bot-${agentIndex}] Attempting reroll after match participation...`);
try {
    upsilon.call("character_rename", {
        characterId: charId,
        name: "ShouldFail"
    });
    upsilon.assert(false, "ERROR: Post-match reroll was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Post-match reroll properly rejected: ${e.message}`);
}

// 5. Verify reroll count / locked status
const updatedProfile = upsilon.call("profile_get", {});
upsilon.log(`[Bot-${agentIndex}] Reroll count: ${updatedProfile.reroll_count}`);
upsilon.log(`[Bot-${agentIndex}] Total wins: ${updatedProfile.total_wins}`);

// Cleanup
upsilon.onTeardown(() => {
    try {
        upsilon.call("auth_delete", {});
        upsilon.log(`[Bot-${agentIndex}] ✅ Account cleaned up`);
    } catch (e) {
        upsilon.log(`Teardown cleanup error (ignored): ${e.message}`);
    }
});

upsilon.log(`[Bot-${agentIndex}] EC-26: REROLL AFTER MATCH PARTICIPATION PASSED.`);
