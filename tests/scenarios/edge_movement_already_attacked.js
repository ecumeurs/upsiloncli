// upsiloncli/tests/scenarios/edge_movement_already_attacked.js
// @test-link [[mech_move_validation_move_validation_already_moved]]
// @test-link [[mech_action_economy]]
// @test-link [[mech_action_economy_action_cost_rules]]
//
// Approach an enemy; when adjacent, attack then try to move. Engine must reject
// with entity.movement.already.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "moveattacked_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-03: Movement Already Attacked`);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVE");

let rejected = false;
let rounds = 0;
while (!rejected && rounds < 60) {
    rounds++;
    const board = upsilon.waitNextTurn();
    if (!board) break;

    const me = upsilon.currentCharacter();
    const foes = upsilon.myFoesCharacters().filter(f => f.hp > 0);
    if (foes.length === 0) break;
    const foe = foes[0];
    const adjacent = (Math.abs(me.position.x - foe.position.x) + Math.abs(me.position.y - foe.position.y)) <= 1;

    if (adjacent) {
        upsilon.call("game_action", {
            id: matchData.match_id,
            type: "attack",
            entity_id: me.id,
            target_coords: [foe.position]
        });

        // Find a valid adjacent tile to move to (not current, not obstacle, not occupied)
        let moveTarget = null;
        const candidates = [
            { x: me.position.x + 1, y: me.position.y },
            { x: me.position.x - 1, y: me.position.y },
            { x: me.position.x, y: me.position.y + 1 },
            { x: me.position.x, y: me.position.y - 1 }
        ];

        for (const cand of candidates) {
            const cell = upsilon.cellAt(board, cand.x, cand.y);
            if (cell && !cell.obstacle && !cell.entity_id) {
                moveTarget = cand;
                break;
            }
        }

        if (!moveTarget) {
            upsilon.log(`[Bot-${agentIndex}] WARNING: No valid adjacent tile found to test movement-after-attack. Skipping this turn.`);
            continue;
        }

        try {
            upsilon.call("game_action", {
                id: matchData.match_id,
                type: "move",
                entity_id: me.id,
                target_coords: [moveTarget]
            });
            upsilon.assert(false, "ERROR: Move after attack accepted");
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] ✅ Move-after-attack rejected: ${e.message} (key=${e.error_key})`);
            upsilon.assertEquals(e.error_key, "entity.movement.already", "Expected entity.movement.already");
            rejected = true;
        }
    } else {
        upsilon.autoBattleTurn(matchData.match_id, foe);
    }
}

upsilon.assert(rejected, "Never reached an enemy to test movement-after-attack within 60 rounds");
upsilon.log(`[Bot-${agentIndex}] EC-03: MOVEMENT ALREADY ATTACKED PASSED.`);
