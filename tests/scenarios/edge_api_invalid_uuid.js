// upsiloncli/tests/scenarios/edge_api_invalid_uuid.js
// @test-link [[upsilonapi:api_profile_character]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "uuid_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-38: Invalid UUID Format`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);

// 2. Get valid character ID for reference
const profile = upsilon.call("profile_characters", {});
upsilon.assert(profile.length > 0, "No characters found");
const validCharId = profile[0].id;
upsilon.log(`[Bot-${agentIndex}] Valid character ID: ${validCharId}`);

// 3. Malformed (non-UUID) characterId. findCharacter() (profile.go) does
// uuid.Parse(id) with no format pre-check; a parse failure panics via
// must(err) and is rendered by the Recovery middleware as a 500 -- this is
// intentional byte-parity with the legacy PHP QueryException triggered by
// the same malformed id (see profile.go's findCharacter comment). It is NOT
// a 4xx validation edge, so the assertion below pins the real 500/message
// rather than an assumed 4xx.
const invalidUUID = "not-a-uuid";
upsilon.log(`[Bot-${agentIndex}] Testing with invalid UUID: ${invalidUUID}...`);

let rejected = false;
try {
    upsilon.call("profile_character", { characterId: invalidUUID });
} catch (e) {
    rejected = true;
    upsilon.assertResponse(e, 500, `invalid UUID length: ${invalidUUID.length}`);
}
upsilon.assert(rejected, `ERROR: Invalid UUID '${invalidUUID}' was accepted!`);
upsilon.log(`[Bot-${agentIndex}] ✅ Invalid UUID '${invalidUUID}' properly rejected with 500 (byte-parity parse panic)`);

// 4. Verify valid UUID still works
upsilon.log(`[Bot-${agentIndex}] Testing with valid UUID...`);
const validResult = upsilon.call("profile_character", { characterId: validCharId });
upsilon.assert(validResult != null, "Valid UUID request failed");
upsilon.log(`[Bot-${agentIndex}] ✅ Valid UUID request succeeded, character: ${validResult.name}`);

upsilon.log(`[Bot-${agentIndex}] EC-38: INVALID UUID FORMAT PASSED.`);
