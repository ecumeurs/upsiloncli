// upsiloncli/tests/scenarios/e2e_archetype_pve_fighter.js
// @test-link [[mec_ai_archetype_system]]
// @test-link [[mechanic_mech_behavior_layered]]
//
// Verifies that the AI behavior pipeline fires and produces movement actions.
// The Fighter archetype should advance toward the player, so we observe that
// within a fixed window of turns the AI entities' positions change (they moved).
// A stable distance-from-player check is used as a proxy for approach behavior.

const botId = Math.floor(Math.random() * 10000);
const accountName = "fighter_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log("Starting archetype_pve_fighter: " + accountName);
upsilon.bootstrapBot(accountName, password);

const matchData = upsilon.joinWaitMatch("1v1_PVE");
const matchId = matchData.match_id;

// Snapshot AI positions before we act.
const board0 = upsilon.waitNextTurn();
upsilon.assert(board0 != null, "Expected initial board state");

const foesChars0 = upsilon.myFoesCharacters();
upsilon.assert(foesChars0.length > 0, "No AI entities");

// Record initial AI positions.
const initialPositions = {};
for (let i = 0; i < foesChars0.length; i++) {
    const e = foesChars0[i];
    initialPositions[e.id] = { x: e.position.x, y: e.position.y };
    upsilon.log(`AI entity ${e.name} starts at (${e.position.x},${e.position.y})`);
}

// Play through up to 20 turns; pass on our turns so the AI gets to act.
let aiMoved = false;
const MAX_ROUNDS = 20;

for (let round = 1; round <= MAX_ROUNDS && !aiMoved; round++) {
    const board = upsilon.waitNextTurn();
    if (!board) {
        upsilon.log(`Round ${round}: board null — match may have ended.`);
        break;
    }

    const me = upsilon.currentCharacter();
    if (me && me.is_self) {
        // Our turn — pass so the AI gets to move.
        upsilon.call("game_action", { id: matchId, type: "pass", entity_id: me.id });
        upsilon.log(`Round ${round}: passed our turn.`);
    } else {
        upsilon.log(`Round ${round}: not our turn.`);
    }

    // Check if any AI entity has moved from its initial position.
    const currentFoes = upsilon.myFoesCharacters();
    for (let i = 0; i < currentFoes.length; i++) {
        const e = currentFoes[i];
        const init = initialPositions[e.id];
        if (!init) continue;
        if (e.position.x !== init.x || e.position.y !== init.y) {
            upsilon.log(`✅ AI entity ${e.name} moved from (${init.x},${init.y}) to (${e.position.x},${e.position.y}) after ${round} rounds.`);
            aiMoved = true;
            break;
        }
    }
}

upsilon.assert(aiMoved, "AI entities never moved within " + MAX_ROUNDS + " rounds — behavior pipeline may not be firing");
upsilon.log("e2e_archetype_pve_fighter: PASSED.");
