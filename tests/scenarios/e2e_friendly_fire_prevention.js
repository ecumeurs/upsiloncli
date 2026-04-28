// upsiloncli/tests/scenarios/e2e_friendly_fire_prevention.js
// @test-link [[rule_friendly_fire]]
// @test-link [[rule_friendly_fire_team_validation]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "ff_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting CR-07: Friendly Fire Prevention`);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVE");
const matchId = matchData.match_id;

const myChars = upsilon.myCharacters();
const char1Id = myChars[0].id;
const char2Id = myChars[1].id;
const char3Id = myChars[2].id;

let success = false;
let rounds = 0;
const MAX_ROUNDS = 100;

while (rounds < MAX_ROUNDS && !success) {
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

    const ally = upsilon.myCharacters().find(e => e.id === targetId && !e.dead);
    if (!ally) {
        upsilon.call("game_action", { id: matchId, type: "pass", entity_id: me.id });
        continue;
    }

    const dist = Math.abs(me.position.x - ally.position.x) + Math.abs(me.position.y - ally.position.y);

    if (dist <= 1) {
        upsilon.log(`[Bot-${agentIndex}] Round ${rounds}: attempting illegal FF on ${ally.name}...`);
        try {
            upsilon.call("game_action", {
                id: matchId,
                type: "attack",
                entity_id: me.id,
                target_coords: [ally.position]
            });
            upsilon.assert(false, "ERROR: Friendly fire attack accepted by server");
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] ✅ Friendly fire rejected: ${e.message} (key=${e.error_key})`);
            upsilon.assertEquals(e.error_key, "entity.attack.friendlyfire", "Expected entity.attack.friendlyfire");
            success = true;
            continue;
        }
    } else {
        const path = upsilon.planTravelToward(me.id, ally.position, board);
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

upsilon.assert(success, "Could not reach an ally to confirm friendly-fire rejection within 100 rounds");
upsilon.log(`[Bot-${agentIndex}] CR-07: FRIENDLY FIRE PREVENTION PASSED.`);
