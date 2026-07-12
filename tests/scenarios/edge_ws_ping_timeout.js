// upsiloncli/tests/scenarios/edge_ws_ping_timeout.js
// @test-link [[api_websocket]]
// @test-link [[req_logging_traceability]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;

upsilon.log(`[Bot-${agentIndex}] Starting EC-48: SSE Async-Broadcast Request-ID Freshness`);

// Architectural note: the CLI's realtime transport migrated off the old
// Pusher/Reverb WebSocket protocol onto the hub's SSE stream
// (GET /api/v1/events, see internal/ws/listener.go) — there are no WS-level
// ping/pong control frames left to test; "Ping/Pong Timeout" describes a
// retired protocol.
//
// The literal closest analogue, the SSE heartbeat comment (": hb\n\n",
// upsilonhub/internal/gateway/events.go), fires every
// defaultHeartbeat = 25s (router.go). That cadence has NO override wired
// anywhere in cmd/upsilonhub/main.go's gateway.Deps{} — SSEHeartbeat is
// only ever overridden in a Go unit test (authenv_test.go:190), never in
// the running binary this suite drives. Waiting out even one real cycle
// would roughly triple this scenario's already-slow ~11s baseline
// (harness-flagged as > 10s). Genuinely observing "does the connection
// survive a heartbeat tick" is impractical inside this suite's runtime
// budget, so it is documented here rather than force-tested — same
// honesty call this audit made for ISS-109 (jump-height, structurally
// unreachable within 1v1_PVE).
//
// The atom index itself already points past the retired ping/pong
// vocabulary: `req_logging_traceability` lists this exact file in its own
// test_links, and its dependent rule (`rule_tracing_logging`,
// "Notification Disconnects") states that async webhooks/broadcasts
// emitted spontaneously by Go are NOT continuations of a previous request
// — Go must mint a *fresh* UUIDv7 request_id for each one. Server-side,
// `sse.BoardFrame` / `sse.MatchFoundFrame` (upsilonhub/internal/gateway/
// sse/sse.go) confirm this: every broadcast envelope is built with
// `RequestID: respond.NewID()`, independent of whatever request triggered
// the underlying game action. That is the real, reachable edge here: do
// two independently-broadcast async SSE events actually carry two
// DIFFERENT fresh request_ids, or does the hub (bug) stamp a whole match
// with one id and reuse it on every push?
//
// (Comparing an async broadcast's request_id against the *triggering*
// HTTP call's own request_id isn't reachable from this script:
// upsilon.call()'s success path returns only resp.Data to JS, never the
// envelope's request_id — a harness-layer ceiling, same class as #43/#49.
// Comparing two async broadcasts against each other is the sharpest edge
// this harness can actually observe, and it still exercises the same
// "fresh ID per async event" rule.)

upsilon.bootstrapBot("ws_ping_bot_" + botId, "VerySecurePassword123!");

upsilon.log(`[Bot-${agentIndex}] Joining a PVE match to receive async SSE broadcast frames...`);
upsilon.joinWaitMatch("1v1_PVE");

const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const gameStarted = upsilon.waitForEvent("game.started", 15000);
upsilon.assert(
    gameStarted != null && typeof gameStarted.request_id === "string" && uuidLike.test(gameStarted.request_id),
    "game.started SSE envelope must carry a valid UUID request_id"
);

const turnStarted = upsilon.waitForEvent("turn.started", 15000);
upsilon.assert(
    turnStarted != null && typeof turnStarted.request_id === "string" && uuidLike.test(turnStarted.request_id),
    "turn.started SSE envelope must carry a valid UUID request_id"
);

upsilon.assert(
    gameStarted.request_id !== turnStarted.request_id,
    "each async SSE broadcast must mint its own fresh request_id, not reuse the previous broadcast's"
);

upsilon.log(`[Bot-${agentIndex}] game.started request_id=${gameStarted.request_id}`);
upsilon.log(`[Bot-${agentIndex}] turn.started request_id=${turnStarted.request_id}`);
upsilon.log(`[Bot-${agentIndex}] EC-48: SSE ASYNC-BROADCAST REQUEST-ID FRESHNESS PASSED.`);
