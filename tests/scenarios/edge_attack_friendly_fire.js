// upsiloncli/tests/scenarios/edge_attack_friendly_fire.js
// @test-link [[rule_friendly_fire]]
// @test-link [[rule_friendly_fire_team_validation]]
// @test-link [[rule_friendly_fire_match_type]]

const agentIndex = upsilon.getAgentIndex();
const agentCount = 4; // 2v2 PvP
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "ff_edge_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-12: Attack Friendly Fire`);

// 1. Setup (2v2 match)
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("2v2_PVP");
upsilon.syncGroup("ff_ready", agentCount);

// 2. Reach and attempt attack on an ally across turns.
let done = false;
let rounds = 0;
while (!done && rounds < 60) {
    rounds++;
    const board = upsilon.waitNextTurn();
    if (!board) break;

    const me = upsilon.currentCharacter();
    const allies = upsilon.myAlliesCharacters().filter(a => a.hp > 0);
    if (allies.length === 0) {
        // Nothing to target; pass and keep waiting.
        upsilon.call("game_action", { id: matchData.match_id, type: "pass", entity_id: me.id });
        continue;
    }
    const ally = allies[0];
    const adjacent = (Math.abs(me.position.x - ally.position.x) + Math.abs(me.position.y - ally.position.y)) <= 1;

    if (adjacent) {
        upsilon.log(`[Bot-${agentIndex}] Attempting illegal attack on ally ${ally.name}...`);
        try {
            upsilon.call("game_action", {
                id: matchData.match_id,
                type: "attack",
                entity_id: me.id,
                target_coords: [ally.position]
            });
            upsilon.assert(false, "ERROR: Friendly fire accepted!");
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] ✅ Friendly fire rejected: ${e.message} (key=${e.error_key})`);
            upsilon.jsAssertEquals("entity.attack.friendlyfire", e.error_key, "Expected entity.attack.friendlyfire");
        }
        done = true;
    } else {
        // Move toward the ally so we can attempt the illegal attack.
        upsilon.autoBattleTurn(matchData.match_id, ally);
    }
}

upsilon.assert(done, "Never reached an ally to attempt friendly-fire within 60 rounds");
upsilon.log(`[Bot-${agentIndex}] EC-12: ATTACK FRIENDLY FIRE PASSED.`);
