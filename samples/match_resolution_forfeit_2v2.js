// samples/match_resolution_forfeit_2v2.js
// @spec-link [[uc_match_resolution]]

const botId = Math.floor(Math.random() * 100000);
const accountName = `forfeit2v2_${botId}`;
const password = "VerySecurePassword123!";

upsilon.log("[Forfeiter 2v2] Registering...");
upsilon.call("auth_register", {
    account_name: accountName,
    email: accountName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: "Forfeit Street",
    birth_date: "1995-05-05"
});

upsilon.onTeardown(() => {
    upsilon.log("[Forfeiter 2v2] Cleaning up...");
    try { upsilon.call("auth_delete", {}); } catch (e) {}
});

upsilon.syncGroup("pvp_test_2v2", 4);

upsilon.log("[Forfeiter 2v2] Joining Matchmaking AS 2v2_PVP...");
upsilon.call("matchmaking_join", { game_mode: "2v2_PVP" });

let matchEvent = upsilon.waitForEvent("match.found", 30000);
upsilon.assert(matchEvent != null, "Matchmaking timed out!");
const matchId = matchEvent.match_id;

upsilon.log("[Forfeiter 2v2] Match found! Sleeping loosely up to 4s to allow arena init and avoid conflict...");
upsilon.sleep(2000 + Math.random() * 2000);

upsilon.log("[Forfeiter 2v2] Executing forfeit...");
try {
    upsilon.call("game_action", {
        match_id: matchId,
        type: "forfeit",
        player_id: upsilon.getContext("user_id")
    });
} catch (e) {
    upsilon.log("[Forfeiter 2v2] Forfeit call threw (maybe teammate already forfeited?): " + e.message);
}

let endEvent = upsilon.waitForEvent("game.ended", 30000);
upsilon.assert(endEvent != null, "Game ended event not received after forfeit!");
upsilon.assert(endEvent.data.winner_team_id !== upsilon.myPlayer().team, "My team should have lost by forfeit!");

upsilon.log("[Forfeiter 2v2] Success! My team forfeited.");
