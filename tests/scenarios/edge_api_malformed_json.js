// upsiloncli/tests/scenarios/edge_api_malformed_json.js
//
// Reframed (ISS-107 audit). Originally titled "Malformed JSON" but its own
// comment admitted the CLI can't produce malformed JSON syntax — every
// `upsilon.call()` param is either passed through as a Go string or run
// through `json.Marshal` (bridge.go's `jsCall`), which by construction only
// ever emits well-formed JSON. Confirmed empirically: no CLI-reachable path
// injects broken JSON syntax; that would require bypassing the bridge and
// writing raw bytes to the socket, a different (and unimplemented) test seam.
//
// The real, sharpest, CLI-reachable edge in this neighborhood is parameter
// *type* validation: `character_upgrade`'s stats are FormRequest-validated as
// `int|min:0` (validateUpgrade, upsilonhub/internal/gateway/profile.go) before
// any character lookup or CP-cap math runs. This scenario pins the type
// branch specifically — a non-integer stat value — which is distinct from:
//   - edge_prog_negative_value.js (same function, the `min:0` branch, n<0)
//   - edge_prog_attribute_cap.js  (the CP-cap branch, downstream of validation)
//   - edge_api_invalid_uuid.js    (malformed characterId *path* param, a
//                                  different failure mode entirely: uuid.Parse
//                                  panics into a 500, not a 422 field error)
// @test-link [[shared:rule_progression]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "paramtype_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-39: Invalid Parameter Type (character_upgrade)`);

// 1. Setup
const regResponse = upsilon.call("auth_register", {
    account_name: accountName,
    email: accountName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: "Test St",
    birth_date: "1990-01-01T00:00:00Z"
});
upsilon.assert(regResponse.user != null, "Registration failed");

const profile = upsilon.call("profile_characters", {});
upsilon.assert(profile.length > 0, "No characters found");
const char = profile[0];
const charId = char.id;

upsilon.log(`[Bot-${agentIndex}] Character: ${char.name}, HP: ${char.hp}`);

// 2. Attempt an HP upgrade with a non-integer value. validateUpgrade calls
// filterValidateInt on every present Class A field before any CP-cap or
// ownership check runs, so a valid characterId is enough to isolate the
// type-check branch cleanly.
upsilon.log(`[Bot-${agentIndex}] Attempting HP upgrade with a non-integer value...`);
try {
    upsilon.call("character_upgrade", {
        characterId: charId,
        hp: "not-a-number"
    });
    upsilon.assert(false, "ERROR: Non-integer HP delta was accepted!");
} catch (e) {
    upsilon.assertResponse(e, 422, "Validation failed");
    const fieldErrors = e.meta && e.meta.errors && e.meta.errors["stats.hp"];
    upsilon.assert(Array.isArray(fieldErrors) && fieldErrors.length > 0,
        "meta.errors missing a stats.hp entry");
    upsilon.assertEquals(fieldErrors[0], "The stats.hp field must be an integer.",
        "Wrong validation message for non-integer HP delta");
    upsilon.log(`[Bot-${agentIndex}] ✅ Non-integer HP delta properly rejected: ${fieldErrors[0]}`);
}

// 3. Verify stats unchanged
const updatedProfile = upsilon.call("profile_character", { characterId: charId });
upsilon.assertEquals(updatedProfile.hp, char.hp, "HP changed after a rejected type-invalid upgrade");
upsilon.log(`[Bot-${agentIndex}] ✅ Stats unchanged`);

// Cleanup
upsilon.onTeardown(() => {
    try {
        upsilon.call("auth_delete", {});
        upsilon.log(`[Bot-${agentIndex}] ✅ Account cleaned up`);
    } catch (e) {
        upsilon.log(`Teardown cleanup error (ignored): ${e.message}`);
    }
});

upsilon.log(`[Bot-${agentIndex}] EC-39: INVALID PARAMETER TYPE PASSED.`);
