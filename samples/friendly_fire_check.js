// samples/friendly_fire_check.js
// @spec-link [[rule_friendly_fire]]

const botId = Math.floor(Math.random() * 100000);
const accountName = "bot_ff_" + botId;
const password = "VeryLongBotPassword123!";

upsilon.bootstrapBot(accountName, password);

// [REMOVED pre-matchmaking sync]

const gameMode = "2v2_PVP";
const matchData = upsilon.joinWaitMatch(gameMode);
const matchId = matchData.match_id;

// Match Verification - Ensure all agents are in the same match
upsilon.syncGroup("match_verification", 4);
upsilon.log("Verified match ID: " + matchId);

upsilon.log("[FF CHECK] Entering 2v2 battle loop for " + accountName);

while (true) {
    const board = upsilon.waitNextTurn();
    if (!board) break;
    
    if (executeFriendlyFireTest(board, matchId)) {
        upsilon.log("[SUCCESS] Friendly fire test complete.");
        break;
    }
}

function executeFriendlyFireTest(board, matchId) {
    const actingEntity = upsilon.currentCharacter();
    if (!actingEntity || !actingEntity.is_self) return false;

    upsilon.log("[FF CHECK] My turn! Attempting to attack an ally...");

    const allies = upsilon.myAlliesCharacters().filter(e => !e.dead);
    if (allies.length === 0) {
        upsilon.log("[FF CHECK] No allies found yet. Passing turn.");
        upsilon.call("game_action", { id: matchId, entity_id: actingEntity.id, type: "pass" });
        return false;
    }

    const targetAlly = allies[0];
    upsilon.log("[FF CHECK] Target ally: " + targetAlly.name + " at " + targetAlly.position.x + "," + targetAlly.position.y);

    try {
        const response = upsilon.call("game_action", {
            id: matchId,
            entity_id: actingEntity.id,
            type: "attack",
            target_coords: targetAlly.position.x + "," + targetAlly.position.y
        });
        
        upsilon.assert(false, "ERROR: Protected ally was successfully attacked! Friendly Fire rule VIOLATED.");
    } catch (e) {
        upsilon.log("[FF CHECK] Caught expected error: " + e.message);
        upsilon.assert(e.message.indexOf("Friendly fire is not allowed") !== -1, "Unexpected error message: " + e.message);
        upsilon.log("[SUCCESS] Server correctly blocked friendly fire.");
        return true;
    }

    return false;
}

upsilon.log("[FF CHECK] Agent lifecycle complete.");
