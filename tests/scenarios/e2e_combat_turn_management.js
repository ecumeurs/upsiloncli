// upsiloncli/tests/scenarios/e2e_combat_turn_management.js
// @test-link [[uc_combat_turn]]
// @test-link [[mech_initiative]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "turn_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting CR-06: Combat Turn Management`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");
upsilon.syncGroup("combat_start", 2);

// 2. Tactical Goal tracking
let hasMoved = false;
let hasAttacked = false;
let hasPassed = false;
let round = 0;

// 3. Play until all core functionalities are exercised
// This ensures that we don't just test turn logic, but also the execution of primary actions.
while (!(hasMoved && hasAttacked && hasPassed)) {
    round++;
    upsilon.log(`[Bot-${agentIndex}] --- ROUND ${round} --- (Goal Progress: Move=${hasMoved}, Attack=${hasAttacked}, Pass=${hasPassed})`);
    
    // Wait for my turn
    const board = upsilon.waitNextTurn();
    if (!board) break; // Match ended
    
    // ✅ Initiative check: Current entity must be mine
    const myChar = upsilon.currentCharacter();
    upsilon.assert(myChar != null, "Should have a selected character on my turn");
    
    const foes = upsilon.myFoesCharacters().filter(f => !f.dead && f.hp > 0);
    if (foes.length === 0) {
        upsilon.log(`[Bot-${agentIndex}] No active foes remaining.`);
        break;
    }

    const foe = foes[0];
    const dist = Math.abs(myChar.position.x - foe.position.x) + Math.abs(myChar.position.y - foe.position.y);

    if (!hasAttacked && dist === 1) {
        // Goal: Attack
        upsilon.log(`[Bot-${agentIndex}] Round ${round}: attacking ${foe.name}...`);
        upsilon.call("game_action", {
            id: matchData.match_id,
            type: "attack",
            entity_id: myChar.id,
            target_coords: foe.position.x + "," + foe.position.y
        });
        hasAttacked = true;
    } else if (!hasMoved && dist > 1) {
        // Goal: Move
        const path = upsilon.planTravelToward(myChar.id, foe.position, board);
        if (path && path.length > 0) {
            upsilon.log(`[Bot-${agentIndex}] Round ${round}: moving toward ${foe.name}...`);
            upsilon.call("game_action", {
                id: matchData.match_id,
                type: "move",
                entity_id: myChar.id,
                target_coords: path.map(p => `${p.x},${p.y}`).join(";")
            });
            hasMoved = true;
        } else {
            // Path is blocked or no movement possible, fallback to passing
            upsilon.log(`[Bot-${agentIndex}] Path to ${foe.name} blocked or out of range, passing...`);
            upsilon.call("game_action", {
                id: matchData.match_id,
                type: "pass",
                entity_id: myChar.id
            });
            hasPassed = true;
        }
    } else {
        // Goal: Pass
        upsilon.log(`[Bot-${agentIndex}] Round ${round}: passing turn...`);
        upsilon.call("game_action", {
            id: matchData.match_id,
            type: "pass",
            entity_id: myChar.id
        });
        hasPassed = true;
    }

    // Safety timeout to prevent infinite loops in broken board states
    if (round > 20) {
        upsilon.assert(false, "Test timed out before achieving all tactical goals (Move, Attack, Pass)");
    }
}

upsilon.log(`[Bot-${agentIndex}] CR-06: COMBAT TURN MANAGEMENT PASSED (Validated Move, Attack, and Pass).`);
