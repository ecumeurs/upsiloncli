// samples/reroll_check.js
// @spec-link [[us_character_reroll]]

const botId = Math.floor(Math.random() * 100000);
const accountName = `reroller_${botId}`;
const password = "VerySecurePassword123!";

upsilon.log("[Reroller] Registering account to test reroll mechanics...");
upsilon.call("auth_register", {
    account_name: accountName,
    email: accountName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: "Reroll Street",
    birth_date: "1995-05-05"
});

upsilon.onTeardown(() => {
    upsilon.log("[Reroller] Cleaning up...");
    try { upsilon.call("auth_delete", {}); } catch (e) {}
});

let profile = upsilon.call("profile_get", {});
let charId = profile.characters[0].id;
let initialTotalWins = profile.total_wins;

// Assert 0 total_wins initially
upsilon.assert(initialTotalWins === 0, "New account should have 0 wins.");

// Attempt 3 successful rerolls
for(let i=1; i<=3; i++) {
    upsilon.log(`[Reroller] Attempting Reroll ${i}/3...`);
    try {
        upsilon.call("character_reroll", { characterId: charId });
        upsilon.log(`[Reroller] Reroll ${i} succeeded.`);
    } catch(err) {
        upsilon.assert(false, `Reroll ${i} failed unexpectedly: ` + err.message);
    }
}

// Attempt 4th reroll, it should fail
upsilon.log("[Reroller] Attempting Reroll 4 (Should Fail)...");
try {
    upsilon.call("character_reroll", { characterId: charId });
    upsilon.assert(false, "ERROR: 4th Reroll succeeded but it is supposed to fail!");
} catch(err) {
    upsilon.log("[Reroller] SUCCESS: 4th Reroll properly rejected -> " + err.message);
}

upsilon.log("[Reroller] Finished reroll checks.");
