// Upsilon Bot: PVE Battle Agent (Refactored with Internal Turn Memory)
// Adheres to [[rule_password_policy]]: 15+ chars, 1 uppercase, 1 digit, 1 special symbol

const botId = Math.floor(Math.random() * 100000);
const accountName = "bot_pve_" + botId;
const password = "VeryLongBotPassword123!";

// 1. Bootstrap Bot (Handles anti-spam delay, registration, and automatic teardown)
upsilon.bootstrapBot(accountName, password);

// 2. Join Matchmaking and Wait
const matchData = upsilon.joinWaitMatch("1v1_PVE");
const matchId = matchData.match_id;

// 3. Battle Loop (Streamlined)
upsilon.log("Entering battle loop...");

while (true) {
    const board = upsilon.waitNextTurn();
    if (!board) break; // Game ended, results logged by helper

    executeTacticalLogic(board, matchId);
}

function executeTacticalLogic(board, matchId) {
    const actingEntity = upsilon.currentCharacter();
    if (!actingEntity || !actingEntity.is_self) return;

    upsilon.log("[Unit: " + actingEntity.name + " | HP: " + actingEntity.hp + "/" + actingEntity.max_hp + " | Attacked: " + actingEntity.has_attacked + "]");

    const enemies = upsilon.myFoesCharacters().filter(e => !e.dead && e.hp > 0);
    if (enemies.length === 0) {
        upsilon.call("game_action", { id: matchId, entity_id: actingEntity.id, type: "pass" });
        return;
    }

    // Find nearest enemy
    let nearestEnemy = enemies.reduce((prev, curr) => {
        const dist = (e) => Math.abs(actingEntity.position.x - e.position.x) + Math.abs(actingEntity.position.y - e.position.y);
        return dist(curr) < dist(prev) ? curr : prev;
    });

    const dist = Math.abs(actingEntity.position.x - nearestEnemy.position.x) + Math.abs(actingEntity.position.y - nearestEnemy.position.y);

    // 1. Attack if adjacent AND we haven't attacked yet (enforced internally too)
    if (dist <= 1 && !actingEntity.has_attacked) {
        upsilon.log("Hacking " + nearestEnemy.name + " to death!");
        upsilon.call("game_action", {
            id: matchId,
            entity_id: actingEntity.id,
            type: "attack",
            target_coords: nearestEnemy.position.x + "," + nearestEnemy.position.y
        });
        return; // Wait for board update to calculate damage
    }

    // 2. Move toward enemy if not adjacent AND we haven't attacked (movement blocked internally if attacked)
    if (dist > 1 && actingEntity.move > 0 && !actingEntity.has_attacked) {
        const pathSteps = upsilon.planTravelToward(actingEntity.id, nearestEnemy.position, board);
        if (pathSteps && pathSteps.length > 0) {
            upsilon.log("Homing missile mode: Moving toward " + nearestEnemy.name);
            upsilon.call("game_action", {
                id: matchId,
                entity_id: actingEntity.id,
                type: "move",
                target_coords: pathSteps.map(p => p.x + "," + p.y).join(";")
            });
            return; // Wait for board update to get our new position
        }
    }

    // 3. Action economy spent. End turn.
    upsilon.log("Action economy spent. Passing to next unit.");
    upsilon.call("game_action", { id: matchId, entity_id: actingEntity.id, type: "pass" });
}

upsilon.log("Agent lifecycle complete.");
