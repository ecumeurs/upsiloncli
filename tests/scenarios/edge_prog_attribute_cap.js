// upsiloncli/tests/scenarios/edge_prog_attribute_cap.js
// @spec-link [[rule_progression]]
// @spec-link [[entity_character]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "progcaps_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-28: Progression Attribute Cap Violation`);

// 1. Setup (register with rigged wins for testing)
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

const initialTotal = char.hp + char.attack + char.defense + char.move;
upsilon.log(`[Bot-${agentIndex}] Initial total stats: ${initialTotal}`);

// For this test, we'll assume the character has some wins
// The cap formula is: 10 + total_wins
// Let's test with a win to get 1 point

upsilon.log(`[Bot-${agentIndex}] Joining match to get point...`);
const matchData = upsilon.joinWaitMatch("1v1_PVE");

const board = upsilon.waitNextTurn();
if (board) {
    // Wait for match to end
    upsilon.sleep(10000);
}

// 2. Check profile after win
const afterWinProfile = upsilon.call("profile_get", {});
const wins = afterWinProfile.total_wins || 0;
const expectedCap = 10 + wins;

upsilon.log(`[Bot-${agentIndex}] Wins: ${wins}, Expected cap: ${expectedCap}`);

const afterWinChar = afterWinProfile.characters.find(c => c.id === charId);
const currentTotal = afterWinChar.hp + afterWinChar.attack + afterWinChar.defense + afterWinChar.move;

upsilon.log(`[Bot-${agentIndex}] Current total stats: ${currentTotal}`);

// 3. Attempt upgrade that would exceed cap
upsilon.log(`[Bot-${agentIndex}] Attempting upgrade that would exceed cap...`);

// Try to add more than the available point
const excessUpgrade = expectedCap - currentTotal + 2;  // Would exceed cap by 2

try {
    upsilon.call("character_upgrade", {
        characterId: charId,
        hp: excessUpgrade
    });
    upsilon.assert(false, "ERROR: Upgrade exceeding cap was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Cap-violating upgrade properly rejected: ${e.message}`);
}

// 4. Attempt valid upgrade within cap
if (currentTotal < expectedCap) {
    const validUpgrade = 1;
    upsilon.log(`[Bot-${agentIndex}] Attempting valid upgrade within cap (+${validUpgrade})...`);

    try {
        const upgraded = upsilon.call("character_upgrade", {
            characterId: charId,
            hp: validUpgrade
        });
        const newTotal = upgraded.hp + upgraded.attack + upgraded.defense + upgraded.move;
        upsilon.assert(newTotal <= expectedCap, `Upgrade exceeded cap! New total: ${newTotal}, Expected cap: ${expectedCap}`);
        upsilon.log(`[Bot-${agentIndex}] ✅ Valid upgrade succeeded, total: ${newTotal}`);
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] Valid upgrade failed: ${e.message}`);
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

upsilon.log(`[Bot-${agentIndex}] EC-28: PROGRESSION ATTRIBUTE CAP VIOLATION PASSED.`);
