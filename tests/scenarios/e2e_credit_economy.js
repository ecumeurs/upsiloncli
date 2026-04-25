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
// Each bot tracks the damage it personally inflicts, then polls /profile
// until the observed `credits` field equals (initial + damage_dealt).
// Premise: 1 hp of damage dealt by an attacker = 1 credit awarded to that
// attacker, persisted to the users table.
//
// Scope note: the same earning rule also applies to healing (1 hp healed = 1
// credit) per [[rule_credit_earning_support]], but the skill-driven actions
// that produce healing are not yet stabilized in the action API. Once skills
// are exposed via game_action, mirror this scenario as
// `e2e_credit_economy_healing.js` — the polling/assertion shape is identical;
// only the action and the CreditAward.source ("healing" vs "damage") differ.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "credit_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting CR-20: Credit Economy (damage-earned credits)`);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");
upsilon.syncGroup("credit_start", 2);

// 1. Snapshot initial credits BEFORE any attack lands.
const initialProfile = upsilon.call("profile_get", {});
const initialCredits = initialProfile.credits || 0;
upsilon.log(`[Bot-${agentIndex}] Initial credits: ${initialCredits}`);

// 2. Play until we land at least one attack and capture the damage we dealt.
let myDamageDealt = 0;
let attacked = false;
let rounds = 0;
const MAX_ROUNDS = 80;

while (!attacked && rounds < MAX_ROUNDS) {
    rounds++;
    const board = upsilon.waitNextTurn();
    if (!board) break; // match ended before we could attack

    const me = upsilon.currentCharacter();
    const foes = upsilon.myFoesCharacters().filter(f => f.hp > 0);
    if (foes.length === 0) break;

    const foe = foes[0];
    const adjacent = (Math.abs(me.position.x - foe.position.x) + Math.abs(me.position.y - foe.position.y)) <= 1;

    if (adjacent) {
        const foeHpBefore = foe.hp;
        // Attack response payload is the post-hit foe entity (handler.go:65-66).
        const result = upsilon.call("game_action", {
            id: matchData.match_id,
            type: "attack",
            entity_id: me.id,
            target_coords: [foe.position]
        });
        const foeHpAfter = (result && result.hp != null) ? result.hp : foeHpBefore;
        myDamageDealt = Math.max(0, foeHpBefore - foeHpAfter);
        attacked = true;
        upsilon.log(`[Bot-${agentIndex}] Attacked ${foe.name} for ${myDamageDealt} damage (${foeHpBefore} → ${foeHpAfter})`);
    } else {
        // Move toward foe via the canonical helper.
        upsilon.autoBattleTurn(matchData.match_id, foe);
    }
}

upsilon.assert(attacked, "Never reached an enemy to deal damage within 80 rounds");
upsilon.assert(myDamageDealt > 0, "Attack landed but no damage was reported (defense too high?)");

// 3. The webhook → Laravel credit increment is asynchronous; poll /profile
// until we observe the expected balance, with a bounded deadline.
let observedCredits = initialCredits;
const expectedCredits = initialCredits + myDamageDealt;
const DEADLINE_MS = 8000;
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

// 4. Sanity: profile_get and any dedicated /profile/credits endpoint must agree.
// The lightweight /profile/credits route is documented in communication.md and
// should mirror the field on /profile. Skip if the CLI route isn't registered.
try {
    const credResp = upsilon.call("profile_credits", {});
    if (credResp && credResp.credits != null) {
        upsilon.assertEquals(credResp.credits, observedCredits, "/profile/credits must match /profile.credits");
        upsilon.log(`[Bot-${agentIndex}] /profile/credits agrees: ${credResp.credits}`);
    }
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] /profile/credits route not exercised: ${e.message || e}`);
}

// 5. Hold the match open long enough that the OTHER bot (which is doing the
// same dance) also gets a chance to land an attack and validate. The teardown
// hook will forfeit on exit; we just want to avoid forfeiting too eagerly.
upsilon.syncGroup("credit_done", 2);

upsilon.log(`[Bot-${agentIndex}] CR-20: CREDIT ECONOMY (DAMAGE) PASSED.`);
