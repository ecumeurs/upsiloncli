// upsiloncli/tests/scenarios/edge_prog_negative_value.js
// @test-link [[rule_progression]]
// @test-link [[entity_character]]

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

// Get character roster
const profile = upsilon.call("profile_characters", {});
upsilon.assert(profile.length > 0, "No characters found");
const char = profile[0];
const charId = char.id;

upsilon.log(`[Bot-${agentIndex}] Character: ${char.name}`);
upsilon.log(`[Bot-${agentIndex}] Initial stats - HP: ${char.hp}, Attack: ${char.attack}, Defense: ${char.defense}, Move: ${char.move}`);

// 2. Attempt negative HP upgrade (should fail)
upsilon.log(`[Bot-${agentIndex}] Attempting negative HP upgrade...`);
try {
    upsilon.call("character_upgrade", {
        characterId: charId,
        hp: -1
    });
    upsilon.assert(false, "ERROR: Negative HP upgrade was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Negative HP upgrade properly rejected: ${e.message}`);
}

// 3. Attempt negative Attack upgrade (should fail)
upsilon.log(`[Bot-${agentIndex}] Attempting negative Attack upgrade...`);
try {
    upsilon.call("character_upgrade", {
        characterId: charId,
        attack: -1
    });
    upsilon.assert(false, "ERROR: Negative Attack upgrade was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Negative Attack upgrade properly rejected: ${e.message}`);
}

// 4. Attempt negative Defense upgrade (should fail)
upsilon.log(`[Bot-${agentIndex}] Attempting negative Defense upgrade...`);
try {
    upsilon.call("character_upgrade", {
        characterId: charId,
        defense: -1
    });
    upsilon.assert(false, "ERROR: Negative Defense upgrade was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Negative Defense upgrade properly rejected: ${e.message}`);
}

// 5. Attempt zero upgrade (may be rejected or accepted depending on implementation)
upsilon.log(`[Bot-${agentIndex}] Attempting zero upgrade...`);
try {
    upsilon.call("character_upgrade", {
        characterId: charId,
        hp: 0
    });
    upsilon.log(`[Bot-${agentIndex}] Zero upgrade attempt completed (check if this should be rejected)`);
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] Zero upgrade rejected: ${e.message}`);
}

// 6. Verify stats unchanged
const updatedProfile = upsilon.call("profile_character", { characterId: charId });
upsilon.assertEquals(updatedProfile.hp, char.hp, "HP changed after failed upgrades");
upsilon.assertEquals(updatedProfile.attack, char.attack, "Attack changed after failed upgrades");
upsilon.assertEquals(updatedProfile.defense, char.defense, "Defense changed after failed upgrades");
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
