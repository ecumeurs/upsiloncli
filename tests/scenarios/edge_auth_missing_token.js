// upsiloncli/tests/scenarios/edge_auth_missing_token.js
// @test-link [[req_security]]

const agentIndex = upsilon.getAgentIndex();

upsilon.log(`[Bot-${agentIndex}] Starting EC-23: Missing Token`);

// Fresh agent session: never registered or logged in, so no bearer token
// is ever cached (upsiloncli only sets the Authorization header when
// Session.Token() is non-empty). Calling a protected endpoint directly
// must be rejected by the gateway's RequireAuth middleware with 401
// before any business logic runs.
try {
    upsilon.call("profile_get", {});
    upsilon.assert(false, "Protected endpoint must reject a request with no bearer token");
} catch (e) {
    upsilon.assertEquals(e.status, 401, "Expected 401 Unauthorized for missing token");
}

upsilon.log(`[Bot-${agentIndex}] EC-23: MISSING TOKEN PASSED.`);
