// upsiloncli/tests/scenarios/e2e_friendly_fire_prevention.js
// @test-link [[rule_friendly_fire]]
// @test-link [[rule_friendly_fire_team_validation]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "ff_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting CR-07: Friendly Fire Prevention`);

// 4 bots: 2v2 PvP. Once everyone is in we publish entity ids and move toward
// our team-mate so we can attempt the illegal attack at point-blank range.
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("2v2_PVP");
upsilon.setShared(`bot_char_id_${agentIndex}`, upsilon.myCharacters()[0].id);
upsilon.syncGroup("ident_exchange", 4);

let success = false;
let rounds = 0;
const MAX_ROUNDS = 60;

while (rounds < MAX_ROUNDS && !success) {
    rounds++;
    const board = upsilon.waitNextTurn();
    if (!board) break;

    const me = upsilon.currentCharacter();
    const allies = upsilon.myAlliesCharacters().filter(a => a.hp > 0);
    if (allies.length === 0) {
        // No ally visible (e.g. solo team because the match started 1v1 fallback);
        // pass and exit cleanly.
        upsilon.call("game_action", { id: matchData.match_id, type: "pass", entity_id: me.id });
        continue;
    }

    const ally = allies[0];
    const adjacent = (Math.abs(me.position.x - ally.position.x) + Math.abs(me.position.y - ally.position.y)) <= 1;

    if (adjacent) {
        upsilon.log(`[Bot-${agentIndex}] Round ${rounds}: attempting illegal FF on ${ally.name}...`);
        try {
            upsilon.call("game_action", {
                id: matchData.match_id,
                type: "attack",
                entity_id: me.id,
                target_coords: [ally.position]
            });
            upsilon.assert(false, "ERROR: Friendly fire attack accepted by server");
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] ✅ Friendly fire rejected: ${e.message} (key=${e.error_key})`);
            upsilon.assertEquals(e.error_key, "entity.attack.friendlyfire", "Expected entity.attack.friendlyfire");
            success = true;
        }
    } else {
        // Walk toward the ally to get into reach, but never attack a foe — that
        // would end the test early or deplete HP needlessly.
        upsilon.autoBattleTurn(matchData.match_id, ally);
    }
}

upsilon.assert(success, "Could not reach an ally to confirm friendly-fire rejection within 60 rounds");
upsilon.log(`[Bot-${agentIndex}] CR-07: FRIENDLY FIRE PREVENTION PASSED.`);
