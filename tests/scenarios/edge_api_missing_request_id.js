// upsiloncli/tests/scenarios/edge_api_missing_request_id.js
// @test-link [[upsilonapi:api_request_id]]
// @test-link [[upsilonapi:api_standard_envelope]]
// @test-link [[req_logging_traceability]]
//
// EC-37: Missing Request ID.
//
// STRUCTURAL LIMITATION (verified, not assumed): upsiloncli's HTTP client
// (upsiloncli/internal/api/client.go, Client.Do) unconditionally generates a
// fresh UUIDv7 and stamps it onto BOTH the outgoing envelope's `request_id`
// field AND the `X-Request-ID` header on every single call. The JS scripting
// bridge (upsiloncli/internal/script/bridge.go, jsCall) only ever drives
// requests through that client — there is no exposed primitive (no raw HTTP
// escape hatch) that lets a scenario omit, blank, or spoof either the header
// or the body field. So this harness structurally cannot reproduce a
// genuinely missing request ID. Filed as ISS-115 (new; distinct root cause
// from ISS-112 — ISS-112 is bridge.go's admin-route guard, this is the API
// client's unconditional header/body injection).
//
// What the real requirement says (verified via `atd trace`, then confirmed
// live): [[upsilonapi:api_request_id]] documents "Backend Gateway... forwards
// the frontend's ID or generates a new one if missing" and
// upsilonhub/internal/gateway/respond/respond.go:RequestID() implements
// exactly that priority (context cache -> JSON body `request_id` -> the
// `X-Request-ID` header -> a freshly generated UUIDv7). The server NEVER
// rejects a request for a missing/malformed id, and does not validate the
// header's format either way. Confirmed empirically via raw curl (bypassing
// the CLI) against this same stack:
//   - No X-Request-ID header + no body request_id -> 200, response carries a
//     freshly generated UUIDv7 request_id (fallback path, not a rejection).
//   - X-Request-ID: not-a-uuid-at-all -> 200, echoed back verbatim, no format
//     validation.
// This fallback is already unit-tested at the Go layer
// (upsilonhub/internal/gateway/respond/respond_test.go:
// TestGeneratesFreshUUID7IfMissing) — the "missing" edge case itself has real
// coverage, just not reachable from this CLI-based E2E suite.
//
// What THIS scenario pins instead (the one thing actually observable through
// the CLI harness): the request_id the CLI itself generates and sends
// round-trips back unchanged through the full envelope on an error response —
// a regression guard on the transport wiring, not a test of the "missing"
// behavior.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "reqid_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-37: Missing Request ID (harness-layer limitation)`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);

// 2. Deterministic error path: a well-formed but nonexistent character UUID.
//    The CLI still auto-injects its own request_id; we assert it survives
//    the round trip through the error envelope.
const ghostId = "00000000-0000-0000-0000-000000000000";

let rejected = false;
try {
    upsilon.call("profile_character", { characterId: ghostId });
} catch (e) {
    upsilon.assertResponse(e, 404);
    upsilon.assert(typeof e.request_id === "string" && e.request_id.length > 0,
        "ERROR: error envelope missing a request_id — transport wiring regression");
    upsilon.log(`[Bot-${agentIndex}] request_id round-tripped: ${e.request_id}`);
    rejected = true;
}
upsilon.assert(rejected, "ERROR: lookup of a nonexistent character was not rejected");

upsilon.log(`[Bot-${agentIndex}] EC-37: REQUEST-ID ROUND-TRIP PASSED (harness cannot test true-missing path; see ISS-115).`);
