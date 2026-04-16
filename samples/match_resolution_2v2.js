// samples/match_resolution_2v2.js
// @spec-link [[uc_match_resolution]]

const botId = Math.floor(Math.random() * 100000);
const accountName = "bot_2v2_" + botId;
const password = "VeryLongBotPassword123!";

upsilon.bootstrapBot(accountName, password);

// [REMOVED pre-matchmaking sync]

const gameMode = "2v2_PVP";
const matchData = upsilon.joinWaitMatch(gameMode);
const matchId = matchData.match_id;

// Match Verification - Ensure all agents are in the same match
upsilon.syncGroup("match_verification", 4);
upsilon.log("Verified match ID: " + matchId);

upsilon.log("Entering 2v2 battle loop...");

while (true) {
    const board = upsilon.waitNextTurn();
    if (!board) break;
    
    executeTacticalLogic(board, matchId);
}

function executeTacticalLogic(board, matchId) {
    const actingEntity = upsilon.currentCharacter();
    if (!actingEntity || !actingEntity.is_self) return;

    upsilon.log("[Unit: " + actingEntity.name + " | HP: " + actingEntity.hp + "/" + actingEntity.max_hp + "]");

    const enemies = upsilon.myFoesCharacters().filter(e => !e.dead && e.hp > 0);
    if (enemies.length === 0) {
        upsilon.call("game_action", { id: matchId, entity_id: actingEntity.id, type: "pass" });
        return;
    }

    let nearestEnemy = enemies.reduce((prev, curr) => {
        const dist = (e) => Math.abs(actingEntity.position.x - e.position.x) + Math.abs(actingEntity.position.y - e.position.y);
        return dist(curr) < dist(prev) ? curr : prev;
    });

    const dist = Math.abs(actingEntity.position.x - nearestEnemy.position.x) + Math.abs(actingEntity.position.y - nearestEnemy.position.y);

    if (dist > 1 && actingEntity.move > 0) {
        const pathSteps = upsilon.planTravelToward(actingEntity.id, nearestEnemy.position, board);
        if (pathSteps && pathSteps.length > 0) {
            upsilon.call("game_action", {
                id: matchId,
                entity_id: actingEntity.id,
                type: "move",
                target_coords: pathSteps.map(p => p.x + "," + p.y).join(";")
            });
        }
    }

    const reDist = Math.abs(actingEntity.position.x - nearestEnemy.position.x) + Math.abs(actingEntity.position.y - nearestEnemy.position.y);
    if (reDist <= 1) {
        upsilon.call("game_action", {
            id: matchId,
            entity_id: actingEntity.id,
            type: "attack",
            target_coords: nearestEnemy.position.x + "," + nearestEnemy.position.y
        });
    }

    upsilon.call("game_action", { id: matchId, entity_id: actingEntity.id, type: "pass" });
}

upsilon.log("2v2 Agent lifecycle complete.");
