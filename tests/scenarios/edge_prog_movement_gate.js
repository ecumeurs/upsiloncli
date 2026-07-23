// upsiloncli/tests/scenarios/edge_prog_movement_gate.js
// @test-link [[rule_progression]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "proggate_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-29: Progression Movement Gate`);

// 1. Setup — a freshly registered account starts at 0 wins.
const regResponse = upsilon.call("auth_register", {
    account_name: accountName,
    email: accountName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: "Test St",
    birth_date: "1990-01-01T00:00:00Z"
});
upsilon.assert(regResponse.user != null, "Registration failed");
upsilon.assertEquals(regResponse.user.total_wins || 0, 0, "Fresh account should start at 0 wins");

// Phase-4 auth cutover: register no longer creates a roster — enroll first.
// @test-link [[mechanic_bot_enrollment]]
upsilon.call("battle_enroll", {});

const profile = upsilon.call("profile_characters", {});
upsilon.assert(profile.length > 0, "No characters found");
const char = profile[0];
const charId = char.id;
const initialMovement = char.movement;
const initialSpentCP = char.spent_cp || 0;

upsilon.log(`[Bot-${agentIndex}] Character: ${char.name}, movement: ${initialMovement}, spent_cp: ${initialSpentCP}, wins: 0`);

// 2. rule_progression v2.1 explicitly retired the old V1 rule that gated
// Movement upgrades to once every 5 wins: "the legacy once every 5 wins
// Movement gate is removed" because Movement self-balances purely through
// its 30 CP/point cost (Class A, highest per-point cost of the roster). The
// edge this scenario pins is exactly that removal: a character sitting at 0
// wins (below the old 5-win threshold) must still be able to buy a Movement
// point as long as it is CP-affordable. If the legacy win-gate were ever
// reintroduced, this call would be rejected instead of succeeding.
upsilon.log(`[Bot-${agentIndex}] Attempting +1 Movement at 0 wins (would be rejected under the removed V1 gate)...`);
const upgraded = upsilon.call("character_upgrade", {
    characterId: charId,
    movement: 1
});

upsilon.assertEquals(upgraded.movement, initialMovement + 1, "Movement did not increase - legacy win-gate may have been reintroduced");
upsilon.assertEquals(upgraded.spent_cp, initialSpentCP + 30, "Movement upgrade did not spend the expected 30 CP");
upsilon.log(`[Bot-${agentIndex}] ✅ Movement upgraded at 0 wins (movement: ${upgraded.movement}, spent_cp: ${upgraded.spent_cp}) — no win-gate enforced`);

// Cleanup
upsilon.onTeardown(() => {
    try {
        upsilon.call("auth_delete", {});
        upsilon.log(`[Bot-${agentIndex}] ✅ Account cleaned up`);
    } catch (e) {
        upsilon.log(`Teardown cleanup error (ignored): ${e.message}`);
    }
});

upsilon.log(`[Bot-${agentIndex}] EC-29: PROGRESSION MOVEMENT GATE PASSED.`);
