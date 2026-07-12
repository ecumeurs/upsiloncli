// upsiloncli/tests/scenarios/edge_ws_connection_no_token.js
// @test-link [[api_websocket]]
// @test-link [[req_security]]

const agentIndex = upsilon.getAgentIndex();

upsilon.log(`[Bot-${agentIndex}] Starting EC-46: SSE Stream Connection Without Token`);

// Architectural note: the CLI's realtime transport migrated off the old
// Pusher/Reverb WebSocket protocol to the hub's SSE stream
// (GET /api/v1/events, see internal/ws/listener.go). There is no
// channel-subscription/auth handshake anymore — the connection itself is
// bearer-authenticated exactly like every other endpoint, via the shared
// RequireAuth() gateway middleware (upsilonhub/internal/gateway/router.go).
// Live-verified: `curl http://<hub>/api/v1/events` with no Authorization
// header returns a genuine 401 ({"message":"-- DEBUG MODE -- Unauthenticated."}),
// byte-identical mechanism/message to edge_auth_missing_token.js (#16).
// /api/v1/events is not registered as a callable route in the CLI's endpoint
// registry, so this scenario cannot drive that HTTP request through
// upsilon.call(...) — same harness-layer ceiling already established for
// #43/#49.
//
// The one thing genuinely distinct from #16 that IS reachable here: the
// SSE Listener's own client-side guard (Listener.Sync()) refuses to even
// attempt a stream connection while no token is held. A fresh agent that
// never authenticates must never observe a live connection.

upsilon.wsConnect();
upsilon.sleep(300); // let any connection attempt land, so this also guards the
                     // server's own 401 (bearerToken() rejects an empty token)
                     // if the client-side guard above were ever removed

const status = upsilon.wsStatus();
upsilon.assertEquals(status.connected, false, "SSE listener must not connect without a bearer token");

upsilon.log(`[Bot-${agentIndex}] EC-46: SSE CONNECTION WITHOUT TOKEN PASSED.`);
