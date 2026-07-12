// upsiloncli/tests/scenarios/edge_attack_target_not_in_range.js
// @test-link [[rule_combat_range_validation]]
//
// preAttackChecks (attack_checks.go) validates occupancy (entity.attack.noentity)
// BEFORE range (entity.attack.outofrange) -- see attack_checks.go:51 vs :74. So the
// edge must target a real, occupied enemy cell that is simply too far away, not an
// arbitrary empty far corner (that exercises the no-entity edge, covered by
// edge_attack_target_no_entity.js, not this one).
//
// Fresh bots have no equipment, so effective range == default AttackRange == 1
// (upsilontypes/property/def/entity.go). Any foe more than 1 cell away (Manhattan)
// is provably out of range for a melee-default attacker.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "notrange_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-13: Attack Target Not in Range`);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVE");

const board = upsilon.waitNextTurn();
if (!board) { upsilon.assert(false, "ERROR: Match ended unexpectedly"); }

const me = upsilon.currentCharacter();
const foes = upsilon.myFoesCharacters();
upsilon.assert(!!foes && foes.length > 0, "FINDING: No foe entities found on this board.");

// Pick the farthest foe -- the simplest, most robust way to guarantee out-of-range.
let target = null;
let bestDist = -1;
for (const foe of foes) {
    const dist = Math.abs(me.position.x - foe.position.x) + Math.abs(me.position.y - foe.position.y);
    if (dist > bestDist) {
        bestDist = dist;
        target = foe;
    }
}

// Default AttackRange is 1 for unequipped characters; anything beyond an adjacent
// cell is out of range. A distance <= 1 here would mean spawn placed the two teams
// adjacent, which would invalidate this edge -- fail loudly rather than false-green.
upsilon.assert(bestDist > 1, `FINDING: Farthest foe is only ${bestDist} away; cannot prove out-of-range.`);

upsilon.log(`[Bot-${agentIndex}] Attempting attack on foe at (${target.position.x},${target.position.y}), Manhattan distance ${bestDist}`);

try {
    upsilon.call("game_action", {
        id: matchData.match_id,
        type: "attack",
        entity_id: me.id,
        target_coords: [{ x: target.position.x, y: target.position.y }]
    });
    upsilon.assert(false, "ERROR: Out-of-range attack accepted by server");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] Out-of-range attack rejected: ${e.message} (key=${e.error_key})`);
    upsilon.assertEquals(e.error_key, "entity.attack.outofrange",
        "Expected exactly entity.attack.outofrange, got: " + e.error_key);
}

upsilon.log(`[Bot-${agentIndex}] EC-13: ATTACK TARGET NOT IN RANGE PASSED.`);
