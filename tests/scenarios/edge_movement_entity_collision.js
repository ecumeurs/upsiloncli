// upsiloncli/tests/scenarios/edge_movement_entity_collision.js
// @test-link [[mech_move_validation_entity_collision]]
// @test-link [[entity_character]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "entitycol_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-02: Movement on Entity Collision`);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVE");
const matchId = matchData.match_id;

let rejected = false;
let rounds = 0;
const MAX_ROUNDS = 100;

while (!rejected && rounds < MAX_ROUNDS) {
    rounds++;
    const board = upsilon.waitNextTurn();
    if (!board) break;

    const me = upsilon.currentCharacter();
    if (!me || !me.is_self) continue;

    // Regroup toward whichever living entity is closest, ally or enemy. Any
    // of our three characters bumping into any other entity is enough to
    // trigger the collision check, and targeting the nearest one (rather
    // than a fixed teammate) keeps this working even if the PVE match wipes
    // part of our team before they manage to group up.
    const others = board.players
        .flatMap(p => p.entities)
        .filter(e => e.id !== me.id && !e.dead);

    if (others.length === 0) {
        upsilon.call("game_action", { id: matchId, type: "pass", entity_id: me.id });
        continue;
    }

    const target = others.reduce((closest, e) => {
        const d = Math.abs(me.position.x - e.position.x) + Math.abs(me.position.y - e.position.y);
        return (!closest || d < closest.dist) ? { entity: e, dist: d } : closest;
    }, null);

    if (target.dist <= 1) {
        upsilon.log(`[Bot-${agentIndex}] Attempting to move ${me.name} onto ${target.entity.name} at (${target.entity.position.x}, ${target.entity.position.y})`);
        try {
            upsilon.call("game_action", {
                id: matchId,
                type: "move",
                entity_id: me.id,
                target_coords: [target.entity.position]
            });
            upsilon.assert(false, "ERROR: Move onto occupied tile accepted");
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] ✅ Entity collision rejected: ${e.message} (key=${e.error_key})`);
            upsilon.assertEquals(e.error_key, "entity.path.occupied", "Expected entity.path.occupied");
            rejected = true;
            continue;
        }
    } else {
        const path = upsilon.planTravelToward(me.id, target.entity.position, board);
        if (path && path.length > 0) {
            upsilon.call("game_action", {
                id: matchId,
                type: "move",
                entity_id: me.id,
                target_coords: path
            });
            continue;
        }
    }

    upsilon.call("game_action", { id: matchId, type: "pass", entity_id: me.id });
}

upsilon.assert(rejected, "Never reached target to test entity collision within 100 rounds");
upsilon.log(`[Bot-${agentIndex}] EC-02: MOVEMENT ON ENTITY COLLISION PASSED.`);
