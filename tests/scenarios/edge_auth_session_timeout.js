// upsiloncli/tests/scenarios/edge_auth_session_timeout.js
// @test-link [[req_security_token_ttl]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "timeout_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-22: Session Timeout (Dead Token)`);

// 1. Register and confirm the fresh token genuinely authenticates.
const regResponse = upsilon.call("auth_register", {
    account_name: accountName,
    email: accountName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: "Test St",
    birth_date: "1990-01-01T00:00:00Z"
});
upsilon.assert(regResponse.user != null, "Registration failed");

const validProfile = upsilon.call("profile_get", {});
upsilon.assert(validProfile != null, "Fresh token should authenticate successfully");

// 2. There is no way to observe the real 15-minute TokenTTL from this CLI:
// no test seam shortens identity.TokenTTL (upsilonhub/internal/platform/
// identity/identity.go), and no host binding lets script code fabricate or
// backdate a bearer token (the Authorization header is always
// Session.Token(), set only from a server response — see
// upsiloncli/internal/api/client.go:100). Waiting out a real 15-minute
// window is not viable for a CI edge case.
//
// The closest deterministic, sub-second proxy: revoke the token server-side
// via auth_logout (RevokeToken -> DeleteToken row), then reuse it.
// upsilon.call uses Endpoint.ExecuteRaw directly (not the higher-level
// Execute() the interactive REPL uses), so the CLI's cached Session.Token()
// is *not* cleared locally — the next request still sends the now-dead
// token. The server rejects it via the exact same AuthenticateToken
// path (pg.go:187-229) that a genuinely expired token hits: "unknown,
// expired, deleted owner" all read as ErrUnauthenticated identically. TTL
// clock math itself (10/15-minute boundaries) is covered deterministically
// by the fake-clock Go unit tests in
// upsilonhub/internal/gateway/token_renewal_test.go.
upsilon.call("auth_logout", {});

try {
    upsilon.call("profile_get", {});
    upsilon.assert(false, "A request carrying a dead (revoked/expired) session token must be rejected");
} catch (e) {
    upsilon.assertEquals(e.status, 401, "Expected 401 Unauthorized for a dead session token");
}

upsilon.log(`[Bot-${agentIndex}] EC-22: SESSION TIMEOUT (DEAD TOKEN) PASSED.`);
