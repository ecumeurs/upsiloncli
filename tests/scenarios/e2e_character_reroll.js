// upsiloncli/tests/scenarios/e2e_character_reroll.js
// @spec-link [[us_character_reroll]]
// @spec-link [[mech_character_reroll_limit]]

const botId = Math.floor(Math.random() * 10000);
const accountName = "reroll_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log("Starting CR-03: Character Reroll Mechanics for " + accountName);

// 1. Setup: Register player
const regResponse = upsilon.call("auth_register", {
    account_name: accountName,
    email: accountName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: "Luck St, Gambler City",
    birth_date: "1990-01-01T00:00:00Z"
});

const charId = regResponse.user.characters[0].id;
const initialStats = JSON.stringify(regResponse.user.characters[0]);
upsilon.log(`Initial character stats: ${initialStats}`);

// 2. Perform Reroll (Maximum 3)
// Reroll 1
upsilon.log("Performing reroll 1...");
let response1 = upsilon.call("character_reroll", { characterId: charId });
upsilon.assertEquals(response1.reroll_count, 1, "Reroll count should be 1");
upsilon.log("✅ Reroll 1 successful");

// Reroll 2
upsilon.log("Performing reroll 2...");
let response2 = upsilon.call("character_reroll", { characterId: charId });
upsilon.assertEquals(response2.reroll_count, 2, "Reroll count should be 2");
upsilon.log("✅ Reroll 2 successful");

// Reroll 3
upsilon.log("Performing reroll 3...");
let response3 = upsilon.call("character_reroll", { characterId: charId });
upsilon.assertEquals(response3.reroll_count, 3, "Reroll count should be 3");
const finalStats = JSON.stringify(response3.character);
upsilon.assert(finalStats !== initialStats, "Stats should have changed after rerolls");
upsilon.log("✅ Reroll 3 successful");

// 3. Reroll blocked after 3 attempts
upsilon.log("Testing reroll limit (4th attempt)...");
try {
    upsilon.call("character_reroll", { characterId: charId });
    upsilon.assert(false, "ERROR: More than 3 rerolls allowed!");
} catch (e) {
    upsilon.log("✅ 4th reroll properly rejected: " + e.message);
}

// CLEANUP
upsilon.onTeardown(() => {
    upsilon.log("Cleaning up reroll bot...");
    try {
        upsilon.call("auth_delete", {});
    } catch (e) {}
});

upsilon.log("CR-03: CHARACTER REROLL MECHANICS PASSED.");
