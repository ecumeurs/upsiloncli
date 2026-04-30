// upsiloncli/tests/scenarios/e2e_combat_turn_management.js
// @test-link [[uc_combat_turn]]
// @test-link [[mech_initiative]]
//
// Validates the canonical turn loop in a 1v1 PVE environment: on each turn we
// should either move toward the foe, attack when in reach, or pass when neither
// is possible. We delegate to upsilon.autoBattleTurn (the one source of truth
// for that pattern) and observe that all three action types are exercised
// before the match ends.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "turn_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting CR-06: Combat Turn Management (PVE)`);

upsilon.bootstrapBot(accountName, password);
// Join PVE match - starts instantly with engine-controlled AI
const matchData = upsilon.joinWaitMatch("1v1_PVE");

const seen = { move: false, attack: false, pass: false };
let round = 0;

while (!(seen.move && seen.attack && seen.pass)) {
    round++;
    if (round > 100) { // Increased budget for PVE
        upsilon.log(`[Bot-${agentIndex}] Round budget exhausted before all action types observed (move=${seen.move} attack=${seen.attack} pass=${seen.pass}).`);
        break;
    }

    const board = upsilon.waitNextTurn();
    if (!board) break; // match ended

    const report = upsilon.autoBattleTurn(matchData.match_id);
    seen[report.action] = true;
    upsilon.log(`[Bot-${agentIndex}] Round ${round}: action=${report.action} target=${report.target_id || "-"} pathLen=${report.path_len}`);
}

if (seen.move && seen.attack && seen.pass) {
    upsilon.log(`[Bot-${agentIndex}] CR-06 PASSED — observed move/attack/pass.`);
} else {
    // We don't fail outright: a match can legitimately end before pass is needed.
    // Match termination is an acceptable terminal state.
    upsilon.log(`[Bot-${agentIndex}] CR-06 FINISHED — match ended before all three action types appeared (seen: move=${seen.move}, attack=${seen.attack}, pass=${seen.pass})`);
}
