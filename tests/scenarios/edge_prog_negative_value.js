// upsiloncli/tests/scenarios/edge_prog_negative_value.js
// @test-link [[rule_progression]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "progneg_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-30: Progression Negative Value`);

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

// Phase-4 auth cutover: register no longer creates a roster — enroll first.
// @test-link [[mechanic_bot_enrollment]]
upsilon.call("battle_enroll", {});

// Get character roster
const profile = upsilon.call("profile_characters", {});
upsilon.assert(profile.length > 0, "No characters found");
const char = profile[0];
const charId = char.id;

upsilon.log(`[Bot-${agentIndex}] Character: ${char.name}`);
upsilon.log(`[Bot-${agentIndex}] Initial stats - HP: ${char.hp}, Attack: ${char.attack}, Defense: ${char.defense}, Movement: ${char.movement}`);

// 2. Attempt a negative HP upgrade delta (rule_progression's Non-Negativity
// constraint: "No attribute is allowed to have a negative value"). HP is the
// cheapest/simplest lever (1 CP/pt) and validateUpgrade's int|min:0 rule
// applies identically to every Class A stat, so one field is sufficient to
// stand at this edge — attack/defense would exercise the exact same check.
upsilon.log(`[Bot-${agentIndex}] Attempting negative HP upgrade...`);
try {
    upsilon.call("character_upgrade", {
        characterId: charId,
        hp: -1
    });
    upsilon.assert(false, "ERROR: Negative HP upgrade was accepted!");
} catch (e) {
    upsilon.assertResponse(e, 422, "Validation failed");
    const fieldErrors = e.meta && e.meta.errors && e.meta.errors["stats.hp"];
    upsilon.assert(Array.isArray(fieldErrors) && fieldErrors.length > 0,
        "meta.errors missing a stats.hp entry");
    upsilon.assertEquals(fieldErrors[0], "The stats.hp field must be at least 0.",
        "Wrong validation message for negative HP delta");
    upsilon.log(`[Bot-${agentIndex}] ✅ Negative HP upgrade properly rejected: ${fieldErrors[0]}`);
}

// 3. Verify stats unchanged
const updatedProfile = upsilon.call("profile_character", { characterId: charId });
upsilon.assertEquals(updatedProfile.hp, char.hp, "HP changed after a rejected negative-value upgrade");
upsilon.log(`[Bot-${agentIndex}] ✅ Stats unchanged`);

// Cleanup
upsilon.onTeardown(() => {
    try {
        upsilon.call("auth_delete", {});
        upsilon.log(`[Bot-${agentIndex}] ✅ Account cleaned up`);
    } catch (e) {
        upsilon.log(`Teardown cleanup error (ignored): ${e.message}`);
    }
});

upsilon.log(`[Bot-${agentIndex}] EC-30: PROGRESSION NEGATIVE VALUE PASSED.`);
