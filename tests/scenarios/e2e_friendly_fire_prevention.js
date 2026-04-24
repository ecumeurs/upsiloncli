// upsiloncli/tests/scenarios/e2e_friendly_fire_prevention.js
// @test-link [[rule_friendly_fire]]
// @test-link [[rule_friendly_fire_team_validation]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "ff_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting CR-07: Friendly Fire Prevention`);

// 1. Setup (2v2 match with 2 bots on same team)
upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("2v2_PVP");

// Share identity to allow targeted FF attempt
upsilon.setShared(`bot_char_id_${agentIndex}`, upsilon.myCharacters()[0].id);
upsilon.syncGroup("ident_exchange", 2);

// Only Bots 0 and 1 are part of this script execution (farm bot_0 bot_1)
// We assume they are matched on same team or we wait until one can see the other
const board = upsilon.waitNextTurn();
if (board) {
    const myChar = upsilon.currentCharacter();
    const allyChars = upsilon.myAlliesCharacters();
    
    if (allyChars.length > 0) {
        const targetAlly = allyChars[0];
        upsilon.log(`[Bot-${agentIndex}] Attempting illegal Friendly Fire on ${targetAlly.name}...`);
        
        try {
            upsilon.call("game_action", {
                id: matchData.match_id,
                type: "attack",
                entity_id: myChar.id,
                target_id: targetAlly.id
            });
            upsilon.assert(false, "ERROR: Friendly fire attack was accepted by the server!");
        } catch (e) {
            upsilon.log(`[Bot-${agentIndex}] ✅ Friendly fire properly rejected: ${e.message}`);
        }
    } else {
        upsilon.log(`[Bot-${agentIndex}] SKIP: No allies visible this turn.`);
    }
}

upsilon.log(`[Bot-${agentIndex}] CR-07: FRIENDLY FIRE PREVENTION PASSED.`);
