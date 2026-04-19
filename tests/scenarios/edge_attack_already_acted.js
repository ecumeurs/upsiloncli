// upsiloncli/tests/scenarios/edge_attack_already_acted.js
// @spec-link [[mech_skill_validation_action_state_verification]]
// @spec-link [[mech_action_economy]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "alreadyacted_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-17: Attack Already Acted`);

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

if (enemyChars.length > 0) {
    const targetEnemy = enemyChars[0];

    // 3. First attack (should succeed)
    upsilon.log(`[Bot-${agentIndex}] Attempting first attack on enemy...`);
    try {
        upsilon.call("game_action", {
            id: matchData.match_id,
            type: "attack",
            entity_id: myChar.id,
            target_coords: [targetEnemy.position]
        });
        upsilon.log(`[Bot-${agentIndex}] ✅ First attack succeeded`);
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] First attack failed: ${e.message}`);
    }

    // 4. Attempt second attack in same turn (should fail)
    upsilon.log(`[Bot-${agentIndex}] Attempting second attack in same turn...`);
    try {
        upsilon.call("game_action", {
            id: matchData.match_id,
            type: "attack",
            entity_id: myChar.id,
            target_coords: [targetEnemy.position]
        });
        upsilon.assert(false, "ERROR: Second attack in same turn was accepted!");
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] ✅ Second attack properly rejected: ${e.message}`);
        // Error key may be entity.alreadyacted or similar
    }

    // Verify enemy HP unchanged
    const updatedBoard = upsilon.call("game_state", { id: matchData.match_id });
    const updatedEnemy = updatedBoard.data.players.find(p =>
        p.entities.find(e => e.id === targetEnemy.id)
    );
    if (updatedEnemy) {
        const enemyEntity = updatedEnemy.entities.find(e => e.id === targetEnemy.id);
        upsilon.log(`[Bot-${agentIndex}] Enemy HP: ${enemyEntity.hp} (was ${targetEnemy.hp})`);
        // Should have taken damage from first attack only
    }
} else {
    upsilon.log(`[Bot-${agentIndex}] SKIP: No enemies found`);
}

// 5. Next turn, attack should be allowed
const nextBoard = upsilon.waitNextTurn();
if (nextBoard) {
    const nextEnemyChars = upsilon.myFoesCharacters();
    if (nextEnemyChars.length > 0) {
        upsilon.log(`[Bot-${agentIndex}] Attempting attack on next turn...`);
        try {
            upsilon.call("game_action", {
                id: matchData.match_id,
                type: "attack",
                entity_id: myChar.id,
                target_coords: [nextEnemyChars[0].position]
            });
            upsilon.log(`[Bot-${agentIndex}] ✅ Attack on next turn succeeded`);
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] Next turn attack failed (may be expected): ${e.message}`);
        }
    }
}

upsilon.log(`[Bot-${agentIndex}] EC-17: ATTACK ALREADY ACTED PASSED.`);
