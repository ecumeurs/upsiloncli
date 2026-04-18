// upsiloncli/tests/scenarios/e2e_matchmaking_pvp_queue.js
// @spec-link [[uc_matchmaking]]
// @spec-link [[rule_matchmaking_single_queue]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "pvp_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting CR-05: Matchmaking Flow (PvP Queue)`);

// 1. Setup: Register & Login (Both agents)
upsilon.bootstrapBot(accountName, password);

// 2. Both agents join the PvP queue
upsilon.log(`[Bot-${agentIndex}] Joining PvP queue...`);
const matchData = upsilon.joinWaitMatch("1v1_PVP");
upsilon.log(`[Bot-${agentIndex}] ✅ Match Found! ID: ${matchData.match_id}`);

// 3. Multi-agent Coordination: Verify they are in the same match
if (agentIndex === 0) {
    upsilon.setShared("pvp_match_id", matchData.match_id);
    upsilon.log("[Bot-0] Broadcasted match ID to shared memory.");
}

// Barrier to ensure both are ready
upsilon.syncGroup("match_sync", 2);

const sharedMatchId = upsilon.getShared("pvp_match_id");
upsilon.assertEquals(matchData.match_id, sharedMatchId, "Agents matched into different arenas!");
upsilon.log(`[Bot-${agentIndex}] ✅ Verified shared Match ID: ${sharedMatchId}`);

// 4. Verify participant roles
const player = upsilon.myPlayer();
const foes = upsilon.myFoes();
upsilon.assertEquals(foes.length, 1, "Should have exactly 1 opponent in 1v1 PvP");
upsilon.assert(player.team !== foes[0].team, "Opponent should be on a different team");

upsilon.log(`[Bot-${agentIndex}] CR-05: MATCHMAKING FLOW (PVP QUEUE) PASSED.`);
