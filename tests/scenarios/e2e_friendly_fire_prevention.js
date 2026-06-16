// upsiloncli/tests/scenarios/e2e_friendly_fire_prevention.js
// @test-link [[rule_friendly_fire]]
// @test-link [[rule_friendly_fire_team_validation]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "ff_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting CR-07: Friendly Fire Prevention`);

upsilon.bootstrapBot(accountName, password);

let success = false;
const MAX_ROUNDS = 100;
const MAX_MATCHES = 3;

for (let matchAttempt = 1; matchAttempt <= MAX_MATCHES && !success; matchAttempt++) {
    if (matchAttempt > 1) {
        upsilon.log(`[Bot-${agentIndex}] Cleaning up session before retry...`);
        try { upsilon.call("matchmaking_leave", {}); } catch (e) {}
        upsilon.sleep(2000);
    }

    upsilon.log(`[Bot-${agentIndex}] Match Attempt ${matchAttempt}/${MAX_MATCHES}...`);
    let matchData;
    try {
        matchData = upsilon.joinWaitMatch("1v1_PVE");
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] Failed to join match: ${e.message}. Retrying...`);
        matchAttempt--; // Don't count this attempt
        upsilon.sleep(3000);
        continue;
    }
    const matchId = matchData.match_id;

    let rounds = 0;
    while (rounds < MAX_ROUNDS && !success) {
        rounds++;
        const board = upsilon.waitNextTurn();
        if (!board || board.game_finished) {
            upsilon.log(`[Bot-${agentIndex}] Match ${matchId} ended (finished=${!!board?.game_finished}).`);
            break;
        }

        const me = upsilon.currentCharacter();
        if (!me || !me.is_self) continue;

        // Find nearest living ally
        const allies = upsilon.myCharacters().filter(e => e.id !== me.id && !e.dead);
        if (allies.length === 0) {
            upsilon.log(`[Bot-${agentIndex}] No living allies found on turn ${rounds}. Passing.`);
            upsilon.call("game_action", { id: matchId, type: "pass", entity_id: me.id });
            continue;
        }

        allies.sort((a, b) => upsilon.distance2D(me.position, a.position) - upsilon.distance2D(me.position, b.position));
        const ally = allies[0];
        const dist = upsilon.distance2D(me.position, ally.position);

        if (dist <= 1) {
            upsilon.log(`[Bot-${agentIndex}] Round ${rounds}: attempting illegal FF on ${ally.name} at distance ${dist}...`);
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
                break; // Exit rounds loop
            }
        } else {
            const path = upsilon.planTravelToward(me.id, ally.position, board);
            if (path && path.length > 0) {
                upsilon.log(`[Bot-${agentIndex}] Moving toward ${ally.name} (dist=${dist})...`);
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
}

upsilon.assert(success, "Could not reach an ally to confirm friendly-fire rejection within 3 matches");
upsilon.log(`[Bot-${agentIndex}] CR-07: FRIENDLY FIRE PREVENTION PASSED.`);
