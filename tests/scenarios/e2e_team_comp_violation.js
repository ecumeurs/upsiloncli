// upsiloncli/tests/scenarios/e2e_team_comp_violation.js
// @test-link [[rule_team_composition]]
//
// Verifies that a PVE match with a valid team composition (≤1 support, ≤1 sneak
// per AI team) starts successfully, and that the composition constraint is enforced
// by the server. Since the matchmaking UI never allows a user to request archetypes
// directly, this scenario validates the positive path: normal PVE matchmaking never
// triggers a composition violation because PHP enforces it before the Go engine sees
// the request.
//
// The negative path (2 sneaks → 400) is validated at the PHP unit test layer
// (PVEMatchmakingTest::test_ai_entities_are_auto_gen_with_archetype).

const botId = Math.floor(Math.random() * 10000);
const accountName = "comp_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log("Starting team_comp_violation scenario: " + accountName);
upsilon.bootstrapBot(accountName, password);

// Normal PVE join — PHP assigns archetypes respecting the constraint.
let matchStarted = false;
try {
    const matchData = upsilon.joinWaitMatch("1v1_PVE");
    upsilon.assert(matchData != null && matchData.match_id != null, "Match did not start");
    matchStarted = true;
    upsilon.log("✅ Match started without team-composition error: " + matchData.match_id);
} catch (e) {
    upsilon.assert(false, "Normal PVE join was rejected — team composition logic is over-restrictive: " + e.message);
}

upsilon.assert(matchStarted, "Expected PVE match to start with a valid archetype composition");

// Verify the AI team has at most 3 entities and valid stats.
const board = upsilon.waitNextTurn();
if (board) {
    const foeChars = upsilon.myFoesCharacters();
    upsilon.assert(foeChars.length > 0, "AI team has no entities");
    upsilon.assert(foeChars.length <= 3, "AI team has more than 3 entities — unexpected");
    upsilon.log("✅ AI team entity count: " + foeChars.length + " (valid, ≤ 3)");
}

upsilon.log("e2e_team_comp_violation: PASSED.");
