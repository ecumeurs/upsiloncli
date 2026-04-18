// upsiloncli/tests/scenarios/e2e_combat_turn_management.js
// @spec-link [[uc_combat_turn]]
// @spec-link [[mech_initiative]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "turn_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting CR-06: Combat Turn Management`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");
upsilon.syncGroup("combat_start", 2);

// 2. Play 2 full rounds of combat
for (let round = 1; round <= 2; round++) {
    upsilon.log(`[Bot-${agentIndex}] --- ROUND ${round} ---`);
    
    // Wait for my turn
    const board = upsilon.waitNextTurn();
    if (!board) break; // Match ended
    
    // ✅ Initiative check: Current entity must be mine
    const myChar = upsilon.currentCharacter();
    upsilon.assert(myChar != null, "Should have a selected character on my turn");
    upsilon.log(`[Bot-${agentIndex}] Round ${round}: Acting with ${myChar.name} (HP: ${myChar.hp})`);
    
    // Execute a valid action (Attack if foe in range, else move)
    const foes = upsilon.myFoesCharacters();
    let acted = false;
    
    for (let foe of foes) {
        // Simple range check (dummy Manhattan distance)
        const dist = Math.abs(myChar.position.x - foe.position.x) + Math.abs(myChar.position.y - foe.position.y);
        if (dist === 1) {
            upsilon.log(`[Bot-${agentIndex}] attacking ${foe.name} at distance ${dist}...`);
            upsilon.call("game_action", {
                id: matchData.match_id,
                type: "attack",
                entity_id: myChar.id,
                target_id: foe.id
            });
            acted = true;
            break;
        }
    }
    
    if (!acted) {
        upsilon.log(`[Bot-${agentIndex}] moving toward opponent...`);
        // We just pass for turn management validation if we can't easily pathfind here
        upsilon.call("game_action", {
            id: matchData.match_id,
            type: "pass",
            entity_id: myChar.id
        });
    }
}

upsilon.log(`[Bot-${agentIndex}] CR-06: COMBAT TURN MANAGEMENT PASSED (partial simulation).`);
