// scratch/progression_test_winner.js
const accountName = "winner_bot_" + Math.floor(Math.random() * 1000);
const password = "SecurePassword123!";

upsilon.log("Starting Winner Bot: " + accountName);

upsilon.onTeardown(() => {
    upsilon.log("Cleaning up winner account");
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
    full_address: "123 Victory Lane, Gamertown",
    birth_date: "1990-01-01"
});

// Join Matchmaking
upsilon.call("matchmaking_join", { game_mode: "1v1_PVP" });
upsilon.log("Joined queue, waiting for opponent...");

let matchEvent = upsilon.waitForEvent("match.found", 45000);
upsilon.assert(matchEvent != null, "Matchmaking timed out!");
upsilon.log("Match found: " + matchEvent.match_id);

// Wait for game to end (triggered by loser's forfeit)
let endEvent = upsilon.waitForEvent("game.ended", 30000);
upsilon.assert(endEvent != null, "Game did not end!");
upsilon.log("Game ended. Winner Team: " + endEvent.data.winner_team_id);

// Check Progression
let myProfile = upsilon.call("auth_login", { account_name: accountName, password: password });
let characters = myProfile.user.characters;
upsilon.assert(characters.length > 0, "No characters found!");

let targetChar = characters[0];
upsilon.log("Current Stats for " + targetChar.name + ": HP=" + targetChar.hp + ", ATK=" + targetChar.attack);

// Attempt Upgrade
upsilon.log("Attempting to upgrade HP...");
let updatedChar = upsilon.call("api_profile_character_upgrade", { 
    id: targetChar.id, 
    stats: { hp: 1 } 
});

upsilon.log("Upgrade successful! New HP: " + updatedChar.hp);
upsilon.assert(updatedChar.hp === targetChar.hp + 1, "HP did not increment correctly!");

upsilon.log("Progression test PASSED for winner.");
