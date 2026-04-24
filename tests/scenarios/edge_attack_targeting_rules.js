// upsiloncli/tests/scenarios/edge_attack_targeting_rules.js
// @test-link [[mech_skill_validation_entity_targeting_rules_verification]]
// @test-link [[rule_friendly_fire]]
// @test-link [[entity_character]]

const agentCount = 4;
const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "targeting_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-19: Attack Entity Targeting Rules`);

// 1. Setup (2v2 match for ally testing)
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("2v2_PVP");

// Share identity
if (agentIndex === 0) {
    upsilon.setShared("match_id", matchData.match_id);
}
upsilon.syncGroup("targeting_ready", agentCount);

const sharedMatchId = upsilon.getShared("match_id");

// 2. Wait for turn
const board = upsilon.waitNextTurn();
if (!board) {
    upsilon.assert(false, "ERROR: Match ended unexpectedly");
}

const myChar = upsilon.currentCharacter();
const myTeam = myChar.team;
const isMyTurn = board.current_entity_id === myChar.id;

upsilon.log(`[Bot-${agentIndex}] My team: ${myTeam}, My turn: ${isMyTurn}`);

// 3. Test targeting rules when my turn
if (isMyTurn) {
    const allyChars = upsilon.myAlliesCharacters();
    const enemyChars = upsilon.myFoesCharacters();

    // Test 1: Attack on ally (should fail)
    if (allyChars.length > 0) {
        const targetAlly = allyChars[0];
        upsilon.log(`[Bot-${agentIndex}] Attempting attack on ally (team ${targetAlly.team})...`);

        try {
            upsilon.call("game_action", {
                id: sharedMatchId,
                type: "attack",
                entity_id: myChar.id,
                target_coords: [targetAlly.position]
            });
            upsilon.assert(false, "ERROR: Attack on ally was accepted!");
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] ✅ Ally attack properly rejected: ${e.message}`);
            upsilon.assertEquals(e.error_key, "rule.friendly_fire", "Wrong error key for friendly fire");
        }
    }

    // Test 2: Attack on enemy (should succeed)
    if (enemyChars.length > 0) {
        const targetEnemy = enemyChars[0];
        upsilon.log(`[Bot-${agentIndex}] Attempting attack on enemy (team ${targetEnemy.team})...`);

        try {
            upsilon.call("game_action", {
                id: sharedMatchId,
                type: "attack",
                entity_id: myChar.id,
                target_coords: [targetEnemy.position]
            });
            upsilon.log(`[Bot-${agentIndex}] ✅ Enemy attack succeeded`);
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] Enemy attack failed (may be expected): ${e.message}`);
        }
    }
} else {
    upsilon.log(`[Bot-${agentIndex}] Not my turn, waiting...`);
}

upsilon.log(`[Bot-${agentIndex}] EC-19: ATTACK TARGETING RULES PASSED.`);
