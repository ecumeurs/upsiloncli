
/**
 * @spec-link [[api_go_battle_engine]]
 * @spec-link [[requirement_customer_user_id_privacy]]
 * @spec-link [[arch_api_id_masking_gateway]]
 */

upsilon.log("Starting e2e_battle_starts_privacy_check...");

// 1. Authenticate and Join a PVE match (1v1_PVE)
const agentIndex = upsilon.getAgentIndex();
upsilon.bootstrapBot("pve_privacy_bot_" + agentIndex, "Password123!_Longer_Password");

const matchData = upsilon.joinWaitMatch("1v1_PVE");

upsilon.assert(matchData && matchData.match_id, "Match creation failed");
const matchId = matchData.match_id;

// 2. Wait for the first turn notification (Battle Started)
const board0 = upsilon.waitNextTurn();
upsilon.assert(board0 != null, "Battle failed to start (no turn notification)");
upsilon.log("Battle started successfully.");

// 3. Foe Privacy Enquiry
const foesChars = upsilon.myFoesCharacters();
upsilon.assert(foesChars.length === 3, "Expected exactly 3 AI entities, found " + foesChars.length);

const initialPositions = {};

for (let i = 0; i < foesChars.length; i++) {
    const e = foesChars[i];
    upsilon.log(`Enquiring AI entity: ${e.name} (Team ${e.team})`);

    // Valid Public Data
    upsilon.assert(e.id != null, `Foe ${i} missing ID`);
    upsilon.assert(e.name != null, `Foe ${i} missing Name`);
    upsilon.assert(e.position != null, `Foe ${i} missing Position`);
    upsilon.assert(e.hp != null, `Foe ${i} missing HP`);
    upsilon.assert(e.team != null, `Foe ${i} missing Team`);

    // Privacy Assertions: Sensitive data should be masked or empty
    upsilon.assert(!e.equipped_skills || e.equipped_skills.length === 0, `PRIVACY VIOLATION: Foe ${e.name} has visible skills`);
    upsilon.assert(!e.equipped_items || e.equipped_items.length === 0, `PRIVACY VIOLATION: Foe ${e.name} has visible items`);
    upsilon.assert(!e.buffs || e.buffs.length === 0, `PRIVACY VIOLATION: Foe ${e.name} has visible buffs`);

    // Sensitive Stat Masking (Attack, Defense, Move should not be revealed for foes)
    // We check if they are non-zero/default (adjust based on masking strategy)
    if (e.attack > 0 || e.defense > 0 || e.move > 0) {
        upsilon.log(`WARNING: Foe ${e.name} stats are visible (Atk:${e.attack}, Def:${e.defense}, Mvt:${e.move})`);
    }

    // Player ID Check (Privacy Concern)
    if (e.player_id) {
        upsilon.log(`CRITICAL PRIVACY CHECK: Foe ${e.name} has player_id: ${e.player_id}`);
    }

    initialPositions[e.id] = { x: e.position.x, y: e.position.y };
}

// 4. Record initial acting character and PASS turn to trigger AI movement
const me = upsilon.currentCharacter();
upsilon.assert(me && me.is_self, "It should be our turn");
upsilon.log(`Our turn (${me.name}). Passing to end turn 1.`);
upsilon.call("game_action", { id: matchId, type: "pass", entity_id: me.id });

// 5. Observation Loop: Exit when at least one foe has moved
let aiMoved = false;
const MAX_ROUNDS = 10;

for (let round = 1; round <= MAX_ROUNDS && !aiMoved; round++) {
    const board = upsilon.waitNextTurn();
    if (!board) {
        upsilon.log("Match ended prematurely.");
        break;
    }

    const currentFoes = upsilon.myFoesCharacters();
    for (let i = 0; i < currentFoes.length; i++) {
        const e = currentFoes[i];
        const init = initialPositions[e.id];
        if (!init) continue;

        if (e.position.x !== init.x || e.position.y !== init.y) {
            upsilon.log(`SUCCESS: AI entity ${e.name} moved to (${e.position.x},${e.position.y}) after ${round} rounds.`);
            aiMoved = true;
            break;
        }
    }

    // If it's our turn again and no one moved, pass again
    const actingNow = upsilon.currentCharacter();
    if (actingNow && actingNow.is_self && !aiMoved) {
        upsilon.call("game_action", { id: matchId, type: "pass", entity_id: actingNow.id });
    }
}

upsilon.assert(aiMoved, "AI entities never moved within timeout");
upsilon.log("e2e_battle_starts_privacy_check: PASSED.");
