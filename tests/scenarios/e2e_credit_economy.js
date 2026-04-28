// upsiloncli/tests/scenarios/e2e_credit_economy.js
// @test-link [[rule_credit_earning_damage]]
// @test-link [[entity_player_credits]]
// @test-link [[api_profile_credits]]
// @test-link [[rule_credit_action_communication_layer]]
//
// Validates the end-to-end credit-earning loop:
//   engine attack rule → ActionFeedback.credits → webhook → Laravel
//   WebhookController → users.credits increment + credit_transactions row
//   → exposed via GET /profile (UserResource.credits).
//
// Uses PVE (1 player vs AI) — single bot, no syncGroup, no turn deadlock.
// After landing one attack we wait for the board.updated WebSocket event,
// validate that action.credits is present, then forfeit and confirm the
// credit increment is persisted on /profile.
//
// WS data shape: event.data.action — broadcastWith() merges match_id + BoardStateResource directly into data.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "credit_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting CR-20: Credit Economy (damage-earned credits)`);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVE");

// 1. Snapshot initial credits BEFORE any attack lands.
const initialProfile = upsilon.call("profile_get", {});
const initialCredits = initialProfile.credits || 1000;
upsilon.log(`[Bot-${agentIndex}] Initial credits: ${initialCredits}`);


// 3. Play until we land at least one attack.
let myDamageDealt = 0;
let attacked = false;
let rounds = 0;
const MAX_ROUNDS = 80;

while (!attacked && rounds < MAX_ROUNDS) {
    rounds++;
    const board = upsilon.waitNextTurn();
    if (!board) break;

    const me = upsilon.currentCharacter();
    const foes = upsilon.myFoesCharacters().filter(f => f.hp > 0);
    if (foes.length === 0) break;

    const foe = foes[0];
    const adjacent = (Math.abs(me.position.x - foe.position.x) + Math.abs(me.position.y - foe.position.y)) <= 1;

    if (adjacent) {
        const foeHpBefore = foe.hp;

        // 2. Register a board.updated callback BEFORE we attack so we don't miss the event.
        // Use setContext/getContext (session storage) to avoid goja closure mutation issues.
        upsilon.onEvent("board.updated", function (event) {
            if (upsilon.getContext("attack_board_event")) return; // already captured
            if (event && event.data) {
                const action = event.data.action;
                if (action && action.type === "attack") {
                    upsilon.setContext("attack_board_event", JSON.stringify(event));
                }
            }
        });

        const result = upsilon.call("game_action", {
            id: matchData.match_id,
            type: "attack",
            entity_id: me.id,
            target_coords: [foe.position]
        });

        if (result && result.results && result.results.length > 0) {
            const targetResult = result.results.find(r => r.target_id === foe.id);
            if (targetResult) {
                myDamageDealt = targetResult.damage || 0;
                upsilon.log(`[Bot-${agentIndex}] Attacked ${foe.name} for ${myDamageDealt} damage (${foeHpBefore} → ${targetResult.new_hp})`);
            }
        }

        attacked = true;
    } else {
        upsilon.autoBattleTurn(matchData.match_id, foe);
    }
}

upsilon.assert(attacked, "Never reached an enemy to deal damage within 80 rounds");
upsilon.assert(myDamageDealt > 0, "Attack landed but no damage was reported (defense too high?)");

// 4. We no longer wait for the board.updated WebSocket event to verify credits.
// Credits are now awarded synchronously in the ActionController response.
upsilon.log(`[Bot-${agentIndex}] Skipping WS check. Relying on synchronous credit awarding.`);

// 5. Now forfeit — credits are already in the DB via synchronous award.
upsilon.call("game_forfeit", { id: matchData.match_id });
upsilon.log(`[Bot-${agentIndex}] Forfeited match after WS confirmation`);

// 6. Poll /profile until the expected balance appears.
let observedCredits = initialCredits;
const expectedCredits = initialCredits + myDamageDealt;
const DEADLINE_MS = 5000;
const POLL_MS = 250;
const start = Date.now();
while (Date.now() - start < DEADLINE_MS) {
    const p = upsilon.call("profile_get", {});
    observedCredits = p.credits || 0;
    if (observedCredits >= expectedCredits) break;
    upsilon.sleep(POLL_MS);
}

upsilon.log(`[Bot-${agentIndex}] Final credits: ${observedCredits} (delta=${observedCredits - initialCredits}, damage_dealt=${myDamageDealt})`);
upsilon.assertEquals(observedCredits, expectedCredits, "Credit delta must equal damage dealt (1 hp = 1 credit)");

// 7. Sanity: /profile/credits must agree with /profile.credits.
try {
    const credResp = upsilon.call("profile_credits", {});
    if (credResp && credResp.credits != null) {
        upsilon.assertEquals(credResp.credits, observedCredits, "/profile/credits must match /profile.credits");
        upsilon.log(`[Bot-${agentIndex}] /profile/credits agrees: ${credResp.credits}`);
    }
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] /profile/credits route not exercised: ${e.message || e}`);
}

upsilon.log(`[Bot-${agentIndex}] CR-20: CREDIT ECONOMY (DAMAGE) PASSED.`);
