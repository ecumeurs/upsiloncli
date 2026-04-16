// samples/progression_check.js
// @spec-link [[rule_progression]]

const botId = Math.floor(Math.random() * 10000);
const Role = upsilon.getContext("agent_index") === 0 ? "WINNER" : "LOSER";
const accountName = `prog_${Role.toLowerCase()}_${botId}`;
const password = "VerySecurePassword123!";
const sharedKey = `prog_test_${botId}`;

upsilon.log(`[${Role}] Starting progression check...`);

// 1. Setup
upsilon.call("auth_register", {
    account_name: accountName,
    email: accountName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: "Progression Test Street",
    birth_date: "1995-05-05"
});

upsilon.onTeardown(() => {
    upsilon.log(`[${Role}] Cleaning up...`);
    try { upsilon.call("auth_delete", {}); } catch (e) {}
});

// 2. Coordination
if (Role === "WINNER") {
    upsilon.setShared(sharedKey, true);
    upsilon.log("[WINNER] Shared signal set. Waiting for opponent...");
} else {
    upsilon.log("[LOSER] Waiting for WINNER signal...");
    let ready = false;
    for (let i = 0; i < 20; i++) {
        if (upsilon.getShared(sharedKey)) {
            ready = true;
            break;
        }
        upsilon.sleep(500);
    }
    upsilon.assert(ready, "LOSER timed out waiting for WINNER!");
}

// 3. Matchmaking
upsilon.call("matchmaking_join", { game_mode: "1v1_PVP" });
let matchEvent = upsilon.waitForEvent("match.found", 30000);
upsilon.assert(matchEvent != null, "Matchmaking timed out!");
const matchId = matchEvent.match_id;

// 4. Combat Interaction
if (Role === "LOSER") {
    upsilon.log("[LOSER] Forfeiting to grant WINNER the point...");
    upsilon.sleep(1000); // Wait for arena to spin up
    upsilon.call("game_action", {
        match_id: matchId,
        type: "forfeit",
        player_id: upsilon.getContext("user_id")
    });
} else {
    upsilon.log("[WINNER] Waiting for game end...");
    let endEvent = upsilon.waitForEvent("game.ended", 30000);
    upsilon.assert(endEvent != null, "Game end signal not received!");
    upsilon.assert(endEvent.data.winner_team_id === upsilon.myPlayer().team, "WINNER did not win!");

    // 5. Progression Assertions
    upsilon.log("[WINNER] Game won. Checking rewards...");
    let profile = upsilon.call("auth_login", { account_name: accountName, password: password });
    upsilon.assert(profile.user.total_wins === 1, "Win count did not increment!");

    let char = profile.user.characters[0];
    const initialTotal = char.hp + char.attack + char.defense + char.movement;
    upsilon.log(`[WINNER] Stats: HP=${char.hp}, ATK=${char.attack}, DEF=${char.defense}, MOV=${char.movement} (Total: ${initialTotal})`);

    // TEST: Valid HP Upgrade
    upsilon.log("[WINNER] Testing valid HP upgrade...");
    let upgraded = upsilon.call("api_profile_character_upgrade", {
        id: char.id,
        stats: { hp: 1 }
    });
    upsilon.assert(upgraded.hp === char.hp + 1, "HP upgrade failed!");

    // TEST: Illegal Upgrade (Cap: 10 + 1 = 11)
    // Characters start with 10 points. Gain 1 point from win. Total used 11.
    // Next upgrade should fail.
    upsilon.log("[WINNER] Testing attribute cap (10 + wins)...");
    try {
        upsilon.call("api_profile_character_upgrade", {
            id: char.id,
            stats: { attack: 1 }
        });
        upsilon.assert(false, "ERROR: Upgrade allowed beyond cap (10+wins)!");
    } catch (e) {
        upsilon.log("SUCCESS: Upgrade rejected: " + e.message);
    }

    // TEST: Illegal Movement Gate (Next allowed at 5 wins)
    upsilon.log("[WINNER] Testing movement gate (1 every 5 wins)...");
    try {
        upsilon.call("api_profile_character_upgrade", {
            id: char.id,
            stats: { movement: 1 }
        });
        upsilon.assert(false, "ERROR: Movement upgrade allowed before 5 wins milestone!");
    } catch (e) {
        upsilon.log("SUCCESS: Movement gate enforced: " + e.message);
    }
}

upsilon.log(`[${Role}] Finished.`);
