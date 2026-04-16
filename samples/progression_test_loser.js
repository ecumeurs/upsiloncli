// scratch/progression_test_loser.js
const accountName = "loser_bot_" + Math.floor(Math.random() * 1000);
const password = "SecurePassword123!";

upsilon.log("Starting Loser Bot: " + accountName);

upsilon.onTeardown(() => {
    upsilon.log("Cleaning up loser account");
    try {
        upsilon.call("auth_delete", {});
    } catch (e) {
        upsilon.log("Cleanup failed: " + e.message);
    }
});

// Authentication
upsilon.call("auth_register", { 
    account_name: accountName, 
    email: accountName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: "456 Defeat Blvd, Lossville",
    birth_date: "1990-01-01"
});

// Join Matchmaking
upsilon.call("matchmaking_join", { game_mode: "1v1_PVP" });
upsilon.log("Joined queue, waiting for opponent...");

let matchEvent = upsilon.waitForEvent("match.found", 45000);
upsilon.assert(matchEvent != null, "Matchmaking timed out!");
upsilon.log("Match found: " + matchEvent.match_id);

// Forfeit the match
upsilon.log("Forfeiting match...");
upsilon.call("game_action", { 
    id: matchEvent.match_id, 
    type: "forfeit" 
});

upsilon.log("Forfeited. Progression test PASSED for loser (conceded).");
