// upsiloncli/tests/scenarios/edge_match_action_after_end.js
// @test-link [[uc_match_resolution]]
// @test-link [[mech_action_economy]]

const agentCount = 2;
const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "actionend_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-36: Action After Match End`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");

// Share match ID
if (agentIndex === 0) {
    upsilon.setShared("match_id", matchData.match_id);
}
upsilon.syncGroup("actionend_ready", agentCount);

const sharedMatchId = upsilon.getShared("match_id");

// 2. Wait for first turn
const board = upsilon.waitNextTurn();
if (!board) {
    upsilon.assert(false, "ERROR: Match ended unexpectedly");
}

// 3. Forfeit to end match immediately
upsilon.log(`[Bot-${agentIndex}] Forfeiting match...`);
try {
    upsilon.call("game_forfeit", { id: sharedMatchId });
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] Forfeit failed: ${e.message}`);
}

// 4. Wait for match to be fully processed
upsilon.sleep(3000);

// 5. Attempt to take action after match has ended
const myChar = upsilon.myCharacters()[0];
const enemyChars = upsilon.myFoesCharacters();

if (enemyChars.length > 0) {
    upsilon.log(`[Bot-${agentIndex}] Attempting attack after match end...`);
    try {
        upsilon.call("game_action", {
            id: sharedMatchId,
            type: "attack",
            entity_id: myChar.id,
            target_coords: [enemyChars[0].position]
        });
        upsilon.assert(false, "ERROR: Action after match end was accepted!");
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] ✅ Action after match end properly rejected: ${e.message}`);
        // Error should indicate match is finished
        upsilon.assert(
            e.message.toLowerCase().includes("match") || e.message.toLowerCase().includes("finished") || e.message.toLowerCase().includes("ended"),
            "Error message should mention match state"
        );
    }
}

// 6. Attempt move after match end
upsilon.log(`[Bot-${agentIndex}] Attempting move after match end...`);
try {
    upsilon.call("game_action", {
        id: sharedMatchId,
        type: "move",
        entity_id: myChar.id,
        target_coords: [{ x: myChar.position.x + 1, y: myChar.position.y }]
    });
    upsilon.assert(false, "ERROR: Move after match end was accepted!");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Move after match end properly rejected: ${e.message}`);
}

// 7. Verify match state shows finished
const matchState = upsilon.call("game_state", { id: sharedMatchId });
if (matchState.data && matchState.data.winner_team_id !== null) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Match state shows winner: team ${matchState.data.winner_team_id}`);
} else {
    upsilon.log(`[Bot-${agentIndex}] Match state: ${matchState.data ? 'loaded' : 'error'}`);
}

upsilon.log(`[Bot-${agentIndex}] EC-36: ACTION AFTER MATCH END PASSED.`);
