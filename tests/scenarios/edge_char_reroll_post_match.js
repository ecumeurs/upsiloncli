// upsiloncli/tests/scenarios/edge_char_reroll_post_match.js
// @test-link [[mech_character_reroll]]
// @test-link [[us_character_reroll]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "rerollpm_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-26: Reroll After Match Participation`);

// 1. Setup (register new account, seeded with 3 characters, reroll_count 0)
const regResponse = upsilon.call("auth_register", {
    account_name: accountName,
    email: accountName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: "Test St",
    birth_date: "1990-01-01T00:00:00Z"
});
upsilon.assert(regResponse.user != null, "Registration failed");

// Phase-4 auth cutover: register no longer creates a roster — enroll first.
// @test-link [[mechanic_bot_enrollment]]
upsilon.call("battle_enroll", {});

const profile = upsilon.call("profile_characters", {});
upsilon.assert(profile.length > 0, "No characters found");
const charId = profile[0].id;
upsilon.log(`[Bot-${agentIndex}] Character ID: ${charId}`);

// 2. Reroll before match (should succeed — creation-flow window, reroll_count 0/3)
upsilon.log(`[Bot-${agentIndex}] Rerolling character before match...`);
upsilon.call("character_reroll", { characterId: charId });
upsilon.log(`[Bot-${agentIndex}] Pre-match reroll succeeded (reroll_count now 1/3)`);

// 3. Join and complete a match
upsilon.log(`[Bot-${agentIndex}] Joining match...`);
const matchData = upsilon.joinWaitMatch("1v1_PVE");
upsilon.log(`[Bot-${agentIndex}] Match joined: ${matchData.match_id}`);

const board = upsilon.waitNextTurn();
if (board) {
    upsilon.log(`[Bot-${agentIndex}] Got turn, forfeiting...`);
    upsilon.call("game_forfeit", { id: matchData.match_id });
}
upsilon.sleep(3000);

// 4. Attempt reroll after match participation. Per mech_character_reroll's
// documented Availability rule ("the reroll is allowed only while the
// account is in the creation flow, after the initial 3 characters have been
// generated"), this must be rejected even though reroll_count (1) is still
// below the 3-attempt cap — the edge under test is the creation-flow/match
// boundary, not the count cap (that's edge_char_reroll_limit's edge).
upsilon.log(`[Bot-${agentIndex}] Attempting reroll after match participation...`);
let rejected = false;
try {
    upsilon.call("character_reroll", { characterId: charId });
} catch (e) {
    rejected = true;
    upsilon.log(`[Bot-${agentIndex}] Post-match reroll rejected: status=${e.status} message=${e.message}`);
}
upsilon.assert(rejected, "Post-match reroll was accepted — no match-participation gate is enforced (see mech_character_reroll Availability rule)");

// Cleanup
upsilon.onTeardown(() => {
    try {
        upsilon.call("auth_delete", {});
        upsilon.log(`[Bot-${agentIndex}] Account cleaned up`);
    } catch (e) {
        upsilon.log(`Teardown cleanup error (ignored): ${e.message}`);
    }
});

upsilon.log(`[Bot-${agentIndex}] EC-26: REROLL AFTER MATCH PARTICIPATION PASSED.`);
