// upsiloncli/tests/scenarios/edge_prog_attribute_cap.js
// @test-link [[rule_progression]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "progcaps_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-28: Progression Attribute Cap Violation`);

// 1. Setup
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

// The cap is expressed in Character Points (CP), not raw attribute points:
// spent_cp MUST NOT exceed 100 + (total_wins * 10) (rule_progression v2.1).
// HP costs exactly 1 CP per point, so it is the simplest lever to land
// exactly on (and one past) the CP boundary without needing to win a match
// first (a fresh account already has a non-zero cap: 100 + 0 wins).
const account = upsilon.call("profile_get", {});
const wins = account.total_wins || 0;
const maxAllowedCP = 100 + wins * 10;
const spentCP = char.spent_cp || 0;

upsilon.log(`[Bot-${agentIndex}] Character: ${char.name}, spent_cp: ${spentCP}, wins: ${wins}, cap: ${maxAllowedCP}`);

// 2. Attempt an HP upgrade that overshoots the cap by exactly 1 CP.
const excessHP = (maxAllowedCP - spentCP) + 1;
const overshotSpentCP = spentCP + excessHP;
const expectedMessage = `Upgrade failed: Total spent CP (${overshotSpentCP}) exceeds the allowed cap (${maxAllowedCP} based on ${wins} wins).`;

upsilon.log(`[Bot-${agentIndex}] Attempting +${excessHP} HP (would spend ${overshotSpentCP} CP, cap is ${maxAllowedCP})...`);
try {
    upsilon.call("character_upgrade", {
        characterId: charId,
        hp: excessHP
    });
    upsilon.assert(false, "ERROR: Upgrade exceeding the CP cap was accepted!");
} catch (e) {
    upsilon.assertResponse(e, 400, expectedMessage);
    upsilon.log(`[Bot-${agentIndex}] ✅ Cap-violating upgrade properly rejected`);
}

// 3. Confirm the boundary is inclusive: an upgrade that lands exactly on the
// cap (not past it) must succeed.
const validHP = maxAllowedCP - spentCP;
upsilon.log(`[Bot-${agentIndex}] Attempting +${validHP} HP (lands exactly on the ${maxAllowedCP} CP cap)...`);
const upgraded = upsilon.call("character_upgrade", {
    characterId: charId,
    hp: validHP
});
upsilon.assertEquals(upgraded.spent_cp, maxAllowedCP, "Valid boundary upgrade did not spend exactly the cap");
upsilon.assertEquals(upgraded.hp, char.hp + validHP, "HP did not increase by the requested amount");
upsilon.log(`[Bot-${agentIndex}] ✅ Boundary upgrade succeeded, spent_cp: ${upgraded.spent_cp}`);

// Cleanup
upsilon.onTeardown(() => {
    try {
        upsilon.call("auth_delete", {});
        upsilon.log(`[Bot-${agentIndex}] ✅ Account cleaned up`);
    } catch (e) {
        upsilon.log(`Teardown cleanup error (ignored): ${e.message}`);
    }
});

upsilon.log(`[Bot-${agentIndex}] EC-28: PROGRESSION ATTRIBUTE CAP VIOLATION PASSED.`);
