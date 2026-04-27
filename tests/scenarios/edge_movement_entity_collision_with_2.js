// upsiloncli/tests/scenarios/edge_movement_entity_collision.js
// @test-link [[mech_move_validation_move_validation_entity_collision]]
// @test-link [[entity_character]]
//
// Close on the enemy until adjacent, then attempt to move *onto* their tile.
// The engine must reject the path with entity.path.occupied.

const agentCount = 2;
const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "entitycol_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-02: Movement on Entity Collision`);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");
if (agentIndex === 0) { upsilon.setShared("match_id", matchData.match_id); }
upsilon.syncGroup("entitycol_ready", agentCount);
const sharedMatchId = upsilon.getShared("match_id");

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
        try {
            upsilon.call("game_action", {
                id: sharedMatchId,
                type: "move",
                entity_id: me.id,
                target_coords: [foe.position]
            });
            upsilon.assert(false, "ERROR: Move onto occupied tile accepted");
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] ✅ Entity collision rejected: ${e.message} (key=${e.error_key})`);
            upsilon.assertEquals(e.error_key, "entity.path.occupied", "Expected entity.path.occupied");
            rejected = true;
        }
        // End turn so the test doesn't stall.
        upsilon.call("game_action", { id: sharedMatchId, type: "pass", entity_id: me.id });
    } else {
        upsilon.autoBattleTurn(sharedMatchId, foe);
    }
}

upsilon.assert(rejected, "Never reached enemy to test entity collision within 60 rounds");
upsilon.log(`[Bot-${agentIndex}] EC-02: MOVEMENT ON ENTITY COLLISION PASSED.`);
