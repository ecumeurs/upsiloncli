// upsiloncli/tests/scenarios/edge_api_5xx_error_handling.js
// @test-link [[upsilonapi:api_standard_envelope]]
//
// NOTE (ISS-107 audit, Phase 8): this file's original premise ("validate 5xx
// error handling infrastructure") cannot be honestly tested here. A genuine,
// deterministic 500 already exists and is already fully covered elsewhere:
// malformed-UUID path params (`profile.go:findCharacter`, and the same
// `uuid.Parse`->`must(err)`->panic->`Recovery()` pattern repeated across
// admin_content.go/game.go/shop.go/equipment.go/skills.go) are rendered by
// the Recovery middleware as a real 500 -- see edge_api_invalid_uuid.js
// (#44), which already pins that exact mechanism with a strict
// assertResponse(e, 500, "invalid UUID length: ...") check. Reusing a
// different uuid.Parse call site here would just be the same mechanism on a
// different route, not a genuinely distinct 5xx trigger -- so this scenario
// is not duplicated onto another endpoint. No CI-safe way exists to trigger
// a *different class* of 5xx (no known unhandled-panic path beyond the
// uuid.Parse one, no resource-exhaustion trick available without harming
// other concurrent scenarios).
//
// Reframed (same honest harness-layer pattern as #43/edge_api_missing_request_id.js):
// this pins the one thing genuinely and deterministically observable here --
// that the Standard Envelope's error shape is strict and complete on a real,
// reachable error (invalid login credentials, 401) -- replacing the
// original's soft `if (e.field) log(...)` duck-typing (which would silently
// pass even if every field were dropped) with hard assertions on every
// mandatory envelope field.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;

upsilon.log(`[Bot-${agentIndex}] Starting edge_api_5xx_error_handling (reframed: strict error-envelope shape)`);

let caught = null;
try {
    upsilon.call("auth_login", {
        account_name: "nonexistent_user_" + botId,
        password: "wrongpassword"
    });
    upsilon.assert(false, "ERROR: Wrong credentials were accepted!");
} catch (e) {
    caught = e;
}

upsilon.assert(caught !== null, "ERROR: auth_login with bad credentials did not throw");

// Strict shape check: every mandatory Standard Envelope field must be
// present with the exact expected value/type -- no "if present" hedging.
upsilon.assertEquals(caught.success, false, "Envelope success flag must be exactly false");
upsilon.assertResponse(caught, 401, "Invalid credentials.");
upsilon.assert(typeof caught.request_id === "string" && caught.request_id.length > 0,
    `Envelope must carry a non-empty request_id (got: ${JSON.stringify(caught.request_id)})`);
upsilon.assert(typeof caught.message === "string" && caught.message.length > 0,
    "Envelope must carry a non-empty message");

// This error class carries no meta.error_key (that field is only populated
// for engine rule-rejections, e.g. movement/attack checks) -- assert its
// genuine absence rather than silently ignoring it, so a regression that
// starts fabricating one is caught too.
upsilon.assert(caught.error_key === undefined,
    `Expected no error_key on a plain credentials rejection (got: ${JSON.stringify(caught.error_key)})`);

upsilon.log(`[Bot-${agentIndex}] Error envelope shape verified: success=false, status=401, message, request_id all present and correct.`);
upsilon.log(`[Bot-${agentIndex}] edge_api_5xx_error_handling PASSED (reframed to strict envelope-shape assertion; see header note on 5xx coverage via #44).`);
