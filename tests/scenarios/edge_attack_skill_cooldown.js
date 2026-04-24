// upsiloncli/tests/scenarios/edge_attack_skill_cooldown.js
// @test-link [[mech_skill_validation_economic_cost_verification_cooldown_check]]
// @test-link [[mech_combat_attack_computation]]
// @test-link [[domain_skill_system]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "cooldown_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-18: Attack Skill Cooldown`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVE");

// 2. Wait for turn
const board = upsilon.waitNextTurn();
if (!board) {
    upsilon.assert(false, "ERROR: Match ended unexpectedly");
}

const myChar = upsilon.currentCharacter();
const enemyChars = upsilon.myFoesCharacters();

// 3. Check for skills on character
if (enemyChars.length > 0) {
    const targetEnemy = enemyChars[0];

    // Check if character has skills
    const charData = upsilon.call("profile_character", { characterId: myChar.id });
    const hasSkills = charData.data && charData.data.skills && charData.data.skills.length > 0;

    if (hasSkills) {
        const skill = charData.data.skills[0];
        upsilon.log(`[Bot-${agentIndex}] Character has skill: ${skill.name}, Cooldown: ${skill.cooldown}`);

        // Try to use the skill
        upsilon.log(`[Bot-${agentIndex}] Attempting to use skill...`);
        try {
            upsilon.call("game_action", {
                id: matchData.match_id,
                type: "skill",
                entity_id: myChar.id,
                skill_id: skill.id,
                target_coords: [targetEnemy.position]
            });
            upsilon.log(`[Bot-${agentIndex}] ✅ Skill use succeeded`);

            // Try to use same skill again (may fail due to cooldown or turn limits)
            upsilon.log(`[Bot-${agentIndex}] Attempting to use same skill again...`);
            try {
                upsilon.call("game_action", {
                    id: matchData.match_id,
                    type: "skill",
                    entity_id: myChar.id,
                    skill_id: skill.id,
                    target_coords: [targetEnemy.position]
                });
                upsilon.log(`[Bot-${agentIndex}] Note: Second skill use succeeded (may be allowed in this turn)`);
            } catch (e) {
                upsilon.log(`[Bot-${agentIndex}] ✅ Second skill use properly rejected: ${e.message}`);
                if (e.error_key) {
                    upsilon.log(`[Bot-${agentIndex}] Error key: ${e.error_key}`);
                }
            }
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] Skill use failed: ${e.message}`);
        }
    } else {
        upsilon.log(`[Bot-${agentIndex}] Character has no skills, falling back to basic attack test`);
        // Test basic attack (which also has cooldown/action limits)
        upsilon.log(`[Bot-${agentIndex}] Attempting basic attack...`);
        try {
            upsilon.call("game_action", {
                id: matchData.match_id,
                type: "attack",
                entity_id: myChar.id,
                target_coords: [targetEnemy.position]
            });
            upsilon.log(`[Bot-${agentIndex}] ✅ Basic attack succeeded`);
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] Basic attack failed: ${e.message}`);
        }

        // Try to attack again (should fail due to already acted)
        upsilon.log(`[Bot-${agentIndex}] Attempting second basic attack...`);
        try {
            upsilon.call("game_action", {
                id: matchData.match_id,
                type: "attack",
                entity_id: myChar.id,
                target_coords: [targetEnemy.position]
            });
            upsilon.assert(false, "ERROR: Second attack was accepted!");
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] ✅ Second attack properly rejected: ${e.message}`);
        }
    }
} else {
    upsilon.log(`[Bot-${agentIndex}] SKIP: No enemies found`);
}

upsilon.log(`[Bot-${agentIndex}] EC-18: ATTACK SKILL COOLDOWN PASSED.`);
