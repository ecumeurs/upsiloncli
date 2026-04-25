// upsiloncli/tests/scenarios/edge_movement_jump_limitations.js
// @test-link [[mech_move_validation_move_validation_jump_limitations]]
// @test-link [[entity_grid]]
//
// Per the atom: jump is a Z-delta constraint between consecutive cells in a
// move path. `|Δheight| > JumpHeight` → rejection with `entity.path.notvalid`.
// JumpHeight defaults to 2 (randomized [2,4) at generation time). It has
// NOTHING to do with "leaping over" obstacles or water.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "jumplimit_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-09: Movement Jump Limitations`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVE");

// 2. Wait for turn
const board = upsilon.waitNextTurn();
if (!board) { upsilon.assert(false, "ERROR: Match ended unexpectedly"); }

const myChar = upsilon.currentCharacter();
const startPos = myChar.position;

// 3. Look for an adjacent cell with |Δheight| > 2 (the default JumpHeight).
// If the Hill generator produced a cliff that steep we must fail the move.
const myCell = upsilon.cellAt(board, startPos.x, startPos.y);
const NEIGHBOURS = [[1,0],[-1,0],[0,1],[0,-1]];
const JUMP_HEIGHT_DEFAULT = 2;

let cliff = null;
for (const [dx, dy] of NEIGHBOURS) {
    const nx = startPos.x + dx;
    const ny = startPos.y + dy;
    const n = upsilon.cellAt(board, nx, ny);
    if (!n) continue;
    if (n.obstacle) continue;
    const delta = Math.abs((n.height || 0) - (myCell ? (myCell.height || 0) : 0));
    if (delta > JUMP_HEIGHT_DEFAULT) {
        cliff = { x: nx, y: ny, delta };
        break;
    }
}

if (!cliff) {
    upsilon.log(`[Bot-${agentIndex}] SKIP: No neighbour with |Δheight| > ${JUMP_HEIGHT_DEFAULT} on this board (Hill map rarely produces such cliffs).`);
} else {
    upsilon.log(`[Bot-${agentIndex}] Attempting single-step jump of Δz=${cliff.delta} to (${cliff.x},${cliff.y})...`);
    try {
        upsilon.call("game_action", {
            id: matchData.match_id,
            type: "move",
            entity_id: myChar.id,
            target_coords: [{ x: cliff.x, y: cliff.y }]
        });
        upsilon.assert(false, `ERROR: Engine accepted a move with |Δheight|=${cliff.delta} > ${JUMP_HEIGHT_DEFAULT}`);
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] ✅ Over-jump rejected: ${e.message} (key=${e.error_key})`);
        upsilon.assertEquals(e.error_key, "entity.path.notvalid", "Expected entity.path.notvalid for Δz violation");
    }

    // Verify character did not move
    const refreshed = upsilon.call("game_state", { id: matchData.match_id });
    const me = refreshed.game_state.players.flatMap(p => p.entities).find(e => e.id === myChar.id);
    upsilon.assertEquals(me.position.x, startPos.x, "Character X moved after failed jump");
    upsilon.assertEquals(me.position.y, startPos.y, "Character Y moved after failed jump");
}

upsilon.log(`[Bot-${agentIndex}] EC-09: MOVEMENT JUMP LIMITATIONS PASSED.`);
