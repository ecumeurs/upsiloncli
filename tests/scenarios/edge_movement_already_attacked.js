// upsiloncli/tests/scenarios/edge_movement_already_attacked.js
// @test-link [[mech_move_validation]]
// @test-link [[mech_action_economy]]
//
// EC-03: After a character attacks, the engine sets its HasMoved flag to true
// (upsilonbattle/.../rules/attack.go). A subsequent move in the SAME turn must
// therefore be rejected with entity.movement.already (mech_move_validation).
//
// ISOLATION NOTE: preMoveChecks (move.go) evaluates the movement-credits gate
// BEFORE the HasMoved gate. If the character spent credits approaching the foe,
// entity.movement.nocredits fires first and the attack->move lock is never
// exercised. We therefore only run the attack->move probe on a FRESH turn
// (movement credits == max, i.e. the entity has not moved this turn) where a
// foe is already adjacent. To reach adjacency without tainting the probe turn,
// we step a single tile toward the foe and then PASS to end the turn — the
// pass is issued in its own loop iteration (gated on me.move < me.max_move) so
// it never races the post-move board snapshot. EndOfTurn restores the credits,
// so the probe turn always starts with full credits. Attack itself never
// touches Movement credits, so the post-attack move still has credits > 0 and
// preMoveChecks reaches the HasMoved gate -> entity.movement.already.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "moveattacked_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-03: Movement Already Attacked`);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVE");
const matchId = matchData.match_id;

let rejected = false;
let rounds = 0;
const MAX_ROUNDS = 120;

while (!rejected && rounds < MAX_ROUNDS) {
    rounds++;
    const board = upsilon.waitNextTurn();
    if (!board) break;

    const me = upsilon.currentCharacter();
    if (!me) continue;

    const foes = upsilon.myFoesCharacters().filter(f => f.hp > 0);
    if (foes.length === 0) break;

    // Nearest living foe.
    const foe = foes.reduce((closest, f) => {
        const d = Math.abs(me.position.x - f.position.x) + Math.abs(me.position.y - f.position.y);
        return (!closest || d < closest.dist) ? { entity: f, dist: d } : closest;
    }, null);

    // If credits are already spent this turn, end it so EndOfTurn resets them.
    // (EndOfTurn restores Movement to max; only moving lowers it, so
    // me.move < me.max_move <=> the entity has already moved this turn.)
    if (me.move < me.max_move) {
        upsilon.call("game_action", { id: matchId, type: "pass", entity_id: me.id });
        continue;
    }

    if (foe.dist <= 1) {
        // Fresh turn (full credits, HasMoved=false) and a foe is adjacent.
        // Pick a clean adjacent tile so the post-attack move passes every
        // preMoveChecks gate EXCEPT HasMoved (entity.movement.already must be
        // the sole failure).
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
            // No isolated tile this turn; end the turn and retry later.
            upsilon.call("game_action", { id: matchId, type: "pass", entity_id: me.id });
            continue;
        }

        // ATTACK: sets HasMoved=true (and HasActed=true) but leaves Movement
        // credits untouched. The turn is NOT advanced by attacking.
        upsilon.call("game_action", {
            id: matchId,
            type: "attack",
            entity_id: me.id,
            target_coords: [foe.entity.position]
        });

        // MOVE in the same turn: credits are full so the credits gates pass and
        // preMoveChecks reaches the HasMoved gate, which must reject with
        // entity.movement.already.
        try {
            upsilon.call("game_action", {
                id: matchId,
                type: "move",
                entity_id: me.id,
                target_coords: [moveTarget]
            });
            upsilon.assert(false, "ERROR: Move after attack was accepted");
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] Move-after-attack rejected: ${e.message} (key=${e.error_key})`);
            upsilon.assertEquals(e.error_key, "entity.movement.already", "Expected entity.movement.already after attack");
            rejected = true;
        }
    } else {
        // Fresh turn but out of reach: step ONE tile toward the foe. The next
        // iteration sees me.move < me.max_move and passes, ending the turn so
        // credits reset. Issuing exactly one action per iteration avoids racing
        // the post-move board snapshot.
        const path = upsilon.planTravelToward(me.id, foe.entity.position, board);
        if (path && path.length > 0) {
            upsilon.call("game_action", {
                id: matchId,
                type: "move",
                entity_id: me.id,
                target_coords: [path[0]]
            });
        } else {
            upsilon.call("game_action", { id: matchId, type: "pass", entity_id: me.id });
        }
    }
}

upsilon.assert(rejected, "Never reached a foe at fresh-turn start to test movement-after-attack within " + MAX_ROUNDS + " rounds");
upsilon.log(`[Bot-${agentIndex}] EC-03: MOVEMENT ALREADY ATTACKED PASSED.`);
