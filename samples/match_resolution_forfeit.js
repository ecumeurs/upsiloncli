// samples/match_resolution_forfeit.js
// @spec-link [[uc_match_resolution]]

const botId = Math.floor(Math.random() * 10000);
const accountName = `forfeit_${botId}`;
const password = "VerySecurePassword123!";

upsilon.log("[Forfeiter] Registering...");
upsilon.call("auth_register", {
    account_name: accountName,
    email: accountName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: "Forfeit Street",
    birth_date: "1995-05-05"
});

upsilon.onTeardown(() => {
    upsilon.log("[Forfeiter] Cleaning up...");
    try { upsilon.call("auth_delete", {}); } catch (e) {}
});

upsilon.log("[Forfeiter] Joining Matchmaking...");
upsilon.call("matchmaking_join", { game_mode: "1v1_PVP" });

let matchEvent = upsilon.waitForEvent("match.found", 30000);
upsilon.assert(matchEvent != null, "Matchmaking timed out!");
const matchId = matchEvent.match_id;

upsilon.log("[Forfeiter] Match found! Sleeping 2s to allow arena init...");
upsilon.sleep(2000);

upsilon.log("[Forfeiter] Executing forfeit...");
upsilon.call("game_action", {
    match_id: matchId,
    type: "forfeit",
    player_id: upsilon.getContext("user_id")
});

let endEvent = upsilon.waitForEvent("game.ended", 30000);
upsilon.assert(endEvent != null, "Game ended event not received after forfeit!");
upsilon.assert(endEvent.data.winner_team_id !== upsilon.myPlayer().team, "I should have lost by forfeit!");

upsilon.log("[Forfeiter] Success! I effectively forfeited the match.");
