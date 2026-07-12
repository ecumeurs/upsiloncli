// upsiloncli/tests/scenarios/edge_ws_wrong_channel.js
// @test-link [[upsilonapi:api_websocket]]
// @test-link [[upsilonapi:api_websocket_arena_updates]]
//
// EC-47: WebSocket Wrong Channel -- ISS-107 audit rewrite (Phase 11).
//
// ARCHITECTURAL PIVOT: the "wrong channel" premise is retired. The CLI's
// realtime transport migrated off the Pusher/Reverb protocol to the hub's
// SSE stream (GET /api/v1/events, internal/ws/listener.go's package doc:
// "there are no channel subscriptions and no broadcasting/auth handshake
// anymore"). There is no channel name left to test the wrongness of. The
// ATD index itself already anticipated this: [[upsilonapi:api_websocket_arena_updates]]
// lists THIS file in its own test_links, and its real logic is the replay
// contract -- reconnecting with Last-Event-ID resumes a persisted board
// snapshot. The modern equivalent of "requesting someone else's channel" is
// forging a Last-Event-ID for a match the caller never joined
// (upsilonhub/internal/gateway/events.go, replayFrame): the id decodes to
// {match_id}:{version}, and `s.battle.IsParticipant(ctx, matchID, userID)`
// (events.go:114) gates the replay -- a non-participant gets nothing, not
// an error (parseEventID's own comment: "garbage must degrade to a fresh
// stream, not an error").
//
// HARNESS-LAYER CEILING (verified, not assumed; same class as #43/ISS-115,
// #49, and #53): the JS scripting bridge exposes wsConnect/wsDisconnect/
// wsStatus/wsSubscribe (internal/script/bridge_ws.go) but none of them can
// set or forge the Last-Event-ID header -- the Listener only ever populates
// it from real event ids it has itself received (listener.go: handleFrame
// -> l.lastEventID = id). jsCall() only drives named routes through the
// endpoint registry with body/query params (bridge.go:101-131);
// /api/v1/events is not a registered route and there is no raw-HTTP escape
// hatch. So this harness structurally cannot drive the actual forgery.
//
// LIVE VERIFICATION (raw curl, bypassing the CLI, against this same running
// stack -- 2026-07-12): registered two throwaway accounts A and B; A joined
// 1v1_PVE (matched immediately vs AI) and its real match_id/version were
// read back from `GET /game/{id}`.
//   - A reconnects to GET /api/v1/events with its OWN bearer token and
//     `Last-Event-ID: {match_id}:0` -> a full replayed board.updated frame
//     comes back (participant, version 0 < stored version: replay fires as
//     designed).
//   - B (never a participant in that match) sends the SAME forged
//     Last-Event-ID against A's match_id, with B's own bearer token -> the
//     response is exactly ": connected\n\n" (13 bytes), byte-identical to B
//     connecting with no Last-Event-ID at all and to B sending a garbage
//     id -- no replay frame, no error, no leak. Confirms IsParticipant
//     (events.go:114-116) is the real, correctly-enforced gate: a forged
//     Last-Event-ID cannot pull another user's/match's tactical state. Not
//     a bug -- the security property holds as documented.
//
// Also confirmed dead: `profile.ws_channel_key`, the OLD scenario's actual
// assertion target, was dropped from the schema entirely by migration
// 000002_drop_ws_channel_key.up.sql -- profile_get can never return it
// again. A live run of the pre-correction scenario confirmed "WS channel
// key not in profile" every time, silently taking the no-op else branch (no
// assertion) -- which is why it was passing, for the wrong reason. Dropped.
//
// Surgical per-recipient board masking (also part of
// [[upsilonapi:api_websocket_arena_updates]]'s logic) already has dedicated
// CLI coverage in e2e_battle_starts_privacy_check.js -- not duplicated here
// (C5: one edge per file).
//
// What THIS scenario pins instead (the closest thing actually reachable
// through the CLI): the legitimate half of the exact mechanism proven above
// -- a bot's own listener, torn down and reconnected mid-match, must still
// resume ITS OWN match's stream via the same Last-Event-ID replay path
// (Listener.lastEventID survives Stop()/Start(), listener.go). This is a
// regression guard on the machinery the authorization check sits inside,
// not a test of the "wrong channel" denial itself -- same framing as #43.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;

upsilon.log(`[Bot-${agentIndex}] Starting EC-47: WebSocket Wrong Channel (harness-layer limitation; real edge verified via raw curl -- see header)`);

// 1. Setup + match. joinWaitMatch already guarantees the listener is live
// and blocks until match.found is received.
upsilon.bootstrapBot("ws_channel_bot_" + botId, "VerySecurePassword123!");
const matchResult = upsilon.joinWaitMatch("1v1_PVE");
upsilon.assert(matchResult != null, "Matchmaking failed");
upsilon.log(`[Bot-${agentIndex}] Match joined: ${matchResult.match_id}`);

let status = upsilon.wsStatus();
upsilon.assert(status.connected === true, "Listener should be connected after a match is found");

// 2. Wait (bounded poll) for the first real event id to land -- match.found
// itself carries no id, but the board.updated/turn.started frame the engine
// pushes moments later does, and that populates the replay cursor.
let cursorBefore = status.socket_id;
const cursorStart = Date.now();
while ((!cursorBefore || cursorBefore.length === 0) && Date.now() - cursorStart < 5000) {
    upsilon.sleep(100);
    cursorBefore = upsilon.wsStatus().socket_id;
}
upsilon.assert(typeof cursorBefore === "string" && cursorBefore.length > 0,
    "Listener should hold a replay cursor (Last-Event-ID) after receiving a board event for its own match");
upsilon.log(`[Bot-${agentIndex}] Replay cursor before reconnect: ${cursorBefore}`);

// 3. Force a disconnect + reconnect: exercises the exact code path
// (streamOnce sending Last-Event-ID on reconnect) that the server-side
// participant-authorization gate (verified above via raw curl) sits on top
// of, for the legitimate case this harness CAN drive.
upsilon.wsDisconnect();
upsilon.sleep(200);
status = upsilon.wsStatus();
upsilon.assert(status.connected === false, "Listener should report disconnected immediately after wsDisconnect()");

upsilon.wsConnect();
const reconnectStart = Date.now();
while (!upsilon.wsStatus().connected && Date.now() - reconnectStart < 5000) {
    upsilon.sleep(100);
}
status = upsilon.wsStatus();
upsilon.assert(status.connected === true, "Listener should reconnect and resume its OWN match's stream");

// 4. Access to its own match must still work post-reconnect -- the
// "right channel" case the authorization gate exists to protect.
const gameState = upsilon.call("game_state", { id: matchResult.match_id });
upsilon.assert(gameState != null, "Game state should remain accessible on the bot's own match after reconnect");

upsilon.log(`[Bot-${agentIndex}] EC-47: WEBSOCKET WRONG CHANNEL PASSED (legit reconnect/replay path verified live; cross-participant Last-Event-ID forgery denial verified via raw curl outside this harness -- see header).`);
