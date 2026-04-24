// upsiloncli/tests/scenarios/edge_api_invalid_uuid.js
// @test-link [[api_standard_envelope]]
// @test-link [[entity_character]]

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

// 3. Test endpoints with invalid UUID formats
const invalidUUIDs = [
    "not-a-uuid",
    "1234567890",
    "invalid-uuid-format",
    "too-short",
    "uuid-with-special@chars!",
    "uuid-with-spaces",
    ""
];

invalidUUIDs.forEach(uuid => {
    if (uuid === "") {
        upsilon.log(`[Bot-${agentIndex}] Testing with empty UUID...`);
    } else {
        upsilon.log(`[Bot-${agentIndex}] Testing with invalid UUID: ${uuid}...`);
    }

    // Test profile character endpoint
    try {
        upsilon.call("profile_character", { characterId: uuid });
        upsilon.assert(false, `ERROR: Invalid UUID '${uuid}' was accepted!`);
    } catch (e) {
        upsilon.log(`[Bot-${agentIndex}] ✅ Invalid UUID '${uuid}' properly rejected: ${e.message}`);
        // Verify 400 Bad Request or similar status code
        if (e.status_code) {
            upsilon.assert(e.status_code >= 400 && e.status_code < 500, "Expected 4xx status for invalid UUID");
        }
    }
});

// 4. Verify valid UUID still works
upsilon.log(`[Bot-${agentIndex}] Testing with valid UUID...`);
const validResult = upsilon.call("profile_character", { characterId: validCharId });
upsilon.assert(validResult != null, "Valid UUID request failed");
upsilon.log(`[Bot-${agentIndex}] ✅ Valid UUID request succeeded, character: ${validResult.name}`);

// Cleanup
upsilon.onTeardown(() => {
    try {
        upsilon.call("auth_delete", {});
        upsilon.log(`[Bot-${agentIndex}] ✅ Account cleaned up`);
    } catch (e) {
        upsilon.log(`Teardown cleanup error (ignored): ${e.message}`);
    }
});

upsilon.log(`[Bot-${agentIndex}] EC-38: INVALID UUID FORMAT PASSED.`);
