// upsiloncli/tests/scenarios/edge_char_reroll_limit.js
// @test-link [[upsilonbattle:mech_character_reroll]]
// @test-link [[us_character_reroll]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "rerolllimit_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-25: Character Reroll Limit`);

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

// Save token for later use
const token = regResponse.token;
upsilon.log(`[Bot-${agentIndex}] Registered successfully`);

// Get character roster
const profile = upsilon.call("profile_characters", {});
upsilon.assert(profile.length > 0, "No characters found");
const charId = profile[0].id;
upsilon.log(`[Bot-${agentIndex}] Character ID: ${charId}`);

// 2. Perform 3 rerolls (should succeed)
for (let i = 1; i <= 3; i++) {
    upsilon.log(`[Bot-${agentIndex}] Reroll #${i}...`);
    const rerollResult = upsilon.call("character_reroll", {
        characterId: charId
    });
    upsilon.log(`[Bot-${agentIndex}] ✅ Reroll #${i} succeeded`);
    upsilon.sleep(500);  // Small delay between rerolls
}

// 3. Attempt 4th reroll (should fail) — the assert-false-on-success lives
// OUTSIDE the try/catch so an unexpected success can't be swallowed by the
// same catch that's meant to handle the expected rejection.
upsilon.log(`[Bot-${agentIndex}] Attempting 4th reroll (should fail)...`);
let fourthRerollRejected = false;
try {
    upsilon.call("character_reroll", {
        characterId: charId
    });
} catch (e) {
    fourthRerollRejected = true;
    upsilon.assertResponse(e, 403, "Reroll limit reached.");
    upsilon.log(`[Bot-${agentIndex}] ✅ 4th reroll properly rejected: ${e.message} (Status: ${e.status})`);
}
upsilon.assert(fourthRerollRejected, "ERROR: 4th reroll was accepted (no exception thrown)!");

// 4. Verify reroll count
const profileInfo = upsilon.call("profile_get", {});
upsilon.log(`[Bot-${agentIndex}] Reroll count: ${profileInfo.reroll_count}`);
upsilon.assertEquals(profileInfo.reroll_count, 3, "Reroll count should be 3");

// Cleanup
upsilon.onTeardown(() => {
    try {
        upsilon.log(`[Bot-${agentIndex}] Leaving queue (if any)...`);
        upsilon.call("matchmaking_leave", {});
    } catch (e) {}

    try {
        upsilon.call("auth_delete", {});
        upsilon.log(`[Bot-${agentIndex}] ✅ Account cleaned up`);
    } catch (e) {
        upsilon.log(`Teardown cleanup error (ignored): ${e.message}`);
    }
});

upsilon.log(`[Bot-${agentIndex}] EC-25: CHARACTER REROLL LIMIT PASSED.`);
