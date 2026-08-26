// upsiloncli/tests/scenarios/edge_auth_session_timeout.js
// @test-link [[uc_auth_logout]]

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

// 1b. Post-Phase-4, auth_register hands back account + token only — no
// roster, no player_stats row. GET /api/v1/profile is battle-scoped and
// 404s ("not enrolled in battle") until this enrollment happens. Enroll
// before the fresh-token profile_get below so that call exercises what it
// claims to: "does a valid token authenticate", not "does an unenrolled
// account 404". Enrollment is additive-only/opt-in by design — there is no
// de-enrollment, so this does not change the account's session/token state
// and keeps the logout-then-reuse assertion below untouched.
upsilon.call("battle_enroll", {});

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
// clock math itself (10/15-minute renewal/expiry boundaries) is covered
// deterministically by the fake-clock Go unit tests
// TestIntrospectRenewsInWindow / TestIntrospectExpiredToken in
// upsilonauth/internal/gateway/introspect_test.go:36-79; renewal logic now
// lives in upsilonauth/internal/gateway/middleware/auth.go:68-97
// (post-Phase-4 — the old upsilonhub token_renewal_test.go was retired in
// the cutover and no longer exists).
upsilon.call("auth_logout", {});

try {
    upsilon.call("profile_get", {});
    upsilon.assert(false, "A request carrying a dead (revoked/expired) session token must be rejected");
} catch (e) {
    upsilon.assertEquals(e.status, 401, "Expected 401 Unauthorized for a dead session token");
}

upsilon.log(`[Bot-${agentIndex}] EC-22: SESSION TIMEOUT (DEAD TOKEN) PASSED.`);
