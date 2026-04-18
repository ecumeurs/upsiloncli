// upsiloncli/tests/scenarios/e2e_customer_onboarding.js
// @spec-link [[uc_player_registration]]
// @spec-link [[us_new_player_onboard]]

const botId = Math.floor(Math.random() * 10000);
const accountName = "onboard_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log("Starting CR-01: Complete New Player Onboarding for " + accountName);

// 1. Player registers with valid credentials
// @spec-link [[rule_password_policy]]
const regResponse = upsilon.call("auth_register", {
    account_name: accountName,
    email: accountName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: "123 Onboarding Way, Tutorial City",
    birth_date: "1990-01-01T00:00:00Z"
});

// ✅ Registration succeeds
upsilon.assert(regResponse.user != null, "Registration failed");
upsilon.log("✅ Registration succeeded");

// 2. System creates account with initial 3-character roster
// @spec-link [[entity_player]]
const characters = regResponse.user.characters;
upsilon.assertEquals(characters.length, 3, "Account should have exactly 3 characters");
upsilon.log("✅ Account created with 3 characters");

// 3. Each character has base stats (3 HP, 1 Move, 1 Attack, 1 Def) + 4 random points
// Total points should be 3+1+1+1 + 4 = 10
characters.forEach((char, index) => {
    const totalStats = char.hp + char.attack + char.defense + char.movement;
    upsilon.log(`Character ${index} stats: HP=${char.hp}, ATK=${char.attack}, DEF=${char.defense}, MOV=${char.movement} (Total=${totalStats})`);
    
    upsilon.assert(char.hp >= 3, `Character ${index} HP should be at least 3`);
    upsilon.assert(char.movement >= 1, `Character ${index} Movement should be at least 1`);
    upsilon.assert(char.attack >= 1, `Character ${index} Attack should be at least 1`);
    upsilon.assert(char.defense >= 1, `Character ${index} Defense should be at least 1`);
    upsilon.assertEquals(totalStats, 10, `Character ${index} should have exactly 10 total stat points`);
});
upsilon.log("✅ Character stats meet base requirements and random dispatch");

// 4. Player receives JWT token and can access dashboard
// (The call helper handles the token; if call succeeds, token was injected)
const profile = upsilon.call("profile_get", {});
upsilon.assert(profile != null, "Could not access profile dashboard");
upsilon.assertEquals(profile.account_name, accountName, "Profile account name mismatch");
upsilon.log("✅ Dashboard accessible with valid JWT token");

// 5. Initial reroll count = 0
upsilon.assertEquals(profile.reroll_count || 0, 0, "Initial reroll count should be 0");
upsilon.log("✅ Initial reroll count is 0");

// CLEANUP
upsilon.onTeardown(() => {
    upsilon.log("Cleaning up onboarding bot...");
    try {
        upsilon.call("auth_delete", {});
    } catch (e) {}
});

upsilon.log("CR-01: NEW PLAYER ONBOARDING PASSED.");
