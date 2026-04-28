// upsiloncli/tests/scenarios/edge_movement_entity_collision.js
// @test-link [[mech_move_validation_move_validation_entity_collision]]
// @test-link [[entity_character]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "entitycol_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-02: Movement on Entity Collision`);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVE");
const matchId = matchData.match_id;

const myChars = upsilon.myCharacters();
const char1Id = myChars[0].id;
const char2Id = myChars[1].id;
const char3Id = myChars[2].id;

let rejected = false;
let rounds = 0;
const MAX_ROUNDS = 100;

while (!rejected && rounds < MAX_ROUNDS) {
    rounds++;
    const board = upsilon.waitNextTurn();
    if (!board) break;

    const me = upsilon.currentCharacter();
    if (!me || !me.is_self) continue;

    // Find a target to move toward
    let targetId;
    if (me.id === char1Id) targetId = char2Id;
    else if (me.id === char2Id) targetId = char1Id;
    else targetId = char2Id;

    const target = upsilon.myCharacters().find(c => c.id === targetId && !c.dead);
    if (!target) {
        upsilon.call("game_action", { id: matchId, type: "pass", entity_id: me.id });
        continue;
    }

    const dist = Math.abs(me.position.x - target.position.x) + Math.abs(me.position.y - target.position.y);
    
    if (dist <= 1) {
        upsilon.log(`[Bot-${agentIndex}] Attempting to move ${me.name} onto ${target.name} at (${target.position.x}, ${target.position.y})`);
        try {
            upsilon.call("game_action", {
                id: matchId,
                type: "move",
                entity_id: me.id,
                target_coords: [target.position]
            });
            upsilon.assert(false, "ERROR: Move onto occupied tile accepted");
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] ✅ Entity collision rejected: ${e.message} (key=${e.error_key})`);
            upsilon.assertEquals(e.error_key, "entity.path.occupied", "Expected entity.path.occupied");
            rejected = true;
            continue;
        }
    } else {
        const path = upsilon.planTravelToward(me.id, target.position, board);
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
