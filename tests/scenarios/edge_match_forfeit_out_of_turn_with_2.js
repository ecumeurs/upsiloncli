// upsiloncli/tests/scenarios/edge_match_forfeit_out_of_turn_with_2.js
// @test-link [[rule_forfeit_battle]]
// @test-link [[uc_match_resolution]]
//
// Per [[rule_forfeit_battle]] forfeit is a player-level action that bypasses
// turn ownership ("Bypasses the need for entity_id"). The expected behaviour
// is that ANY participant can forfeit at ANY moment. This test asserts that
// premise: bot 1 forfeits while it is bot 0's turn, and the engine accepts
// the forfeit.
//
// Both bots only PASS on their own turns (no attacking): "1v1_PVP" fields a
// full 3-character squad per side, so turn order interleaves across 6
// entities, and letting either side fight would let the match conclude via
// ordinary combat resolution before bot 1 ever lands its forfeit. Passing
// keeps the match alive indefinitely so bot 1 gets a real shot at an
// opponent's-turn window.
//
// Bot 0's own round budget must not be tighter than bot 1's polling budget.
// bootstrapBot's teardown hook auto-forfeits on behalf of any bot that exits
// its script while still holding a live match_id in its local CLI context
// (upsiloncli/internal/script/bridge_battle.go's jsWaitNextTurn only clears
// that context on a *real* game.ended/game_finished signal). Confirmed live:
// with bot 0 capped at 80 of its own turn round-trips (fast, tens of ms each)
// against bot 1's 80 x 150ms (~12s) polling budget, bot 0 exhausted its own
// cap and exited *before* bot 1 ever observed an opponent's-turn window --
// its own teardown then fired an unscripted forfeit, ending the match from
// the wrong side and making bot 1's later, deliberate forfeit call 400
// "arena.notfound" (arena already gone). Bot 0's loop must only ever end via
// the natural game.ended/game_finished path (which does clear match_id and
// suppresses the teardown-forfeit) -- so its round cap is set far above any
// realistic turn count rather than racing bot 1's wall-clock budget.
//
// "Is it my turn?" must be checked at the player level
// (`current_player_is_self`), not by comparing current_entity_id against a
// single arbitrarily-chosen owned character -- doing so misfires as soon as
// one of bot 1's *other* two characters holds the turn, silently forfeiting
// during bot 1's own turn instead of bot 0's (also confirmed live).
//
// Sampling-rate note: bot 0 reacts to its own turn via a blocking SSE wait
// (near-instant, single-digit ms), while bot 1 detects "opponent's turn" by
// polling GET /game/{id} on a fixed interval. Left asymmetric, bot 1's poll
// almost always lands during its OWN (poll-latency-bound, therefore much
// longer-lived) turn and effectively never samples the opponent's much
// shorter window -- confirmed live via a raw HTTP repro: with both sides
// reacting at comparable speed the split is ~50/50, but with bot 0 reacting
// instantly, 150/151 consecutive polls landed on "self". Bot 0 therefore
// pauses briefly before acting on its own turn, deliberately widening the
// opponent-turn window bot 1 is polling for.

const agentCount = 2;
const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "forfeitoot_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-35: Forfeit Out of Turn`);

upsilon.bootstrapBot(accountName, password);
const matchData = upsilon.joinWaitMatch("1v1_PVP");

if (agentIndex === 0) { upsilon.setShared("match_id", matchData.match_id); }
upsilon.syncGroup("forfeitoot_ready", agentCount);
const sharedMatchId = upsilon.getShared("match_id");

if (agentIndex === 1) {
    // Bot 1 is the conceder. Wait until the active turn belongs to the
    // opponent (current_player_is_self === false), then issue the forfeit.
    // Per the rule this must succeed regardless of whose turn it is.
    let forfeited = false;
    let attempts = 0;
    while (!forfeited && attempts < 400) {
        attempts++;
        upsilon.sleep(50);
        const state = upsilon.call("game_state", { id: sharedMatchId });
        const bs = state.game_state;
        // Skip the pre-turn window: right after game.started the engine
        // reports a zero entity_id with no player owning it yet.
        if (!bs || !bs.current_entity_id || bs.current_entity_id === "00000000-0000-0000-0000-000000000000") continue;

        if (bs.current_player_is_self) {
            // Our own turn (any of our 3 characters) — pass, don't fight, so
            // the match stays alive and turn order keeps cycling.
            upsilon.call("game_action", { id: sharedMatchId, type: "pass", entity_id: bs.current_entity_id });
            continue;
        }

        upsilon.log(`[Bot-${agentIndex}] Forfeiting while opponent (entity ${bs.current_entity_id}) holds initiative...`);
        upsilon.call("game_forfeit", { id: sharedMatchId });
        forfeited = true;
    }
    upsilon.assert(forfeited, "Never observed opponent's turn to forfeit out of ours");
} else {
    // Bot 0 also just passes through its own turns -- the match must only
    // ever end via bot 1's forfeit, never via combat.
    // Deliberately far above bot 1's poll budget (400 x 50ms ~= 20s) --
    // see header note: this loop must only exit via the natural
    // game.ended/game_finished path, never by exhausting this counter.
    let rounds = 0;
    while (rounds < 2000) {
        rounds++;
        const board = upsilon.waitNextTurn();
        if (!board) break;
        // Widen the opponent-turn window (see header note) so bot 1's poll
        // has a realistic chance to sample it before we pass it right back.
        upsilon.sleep(100);
        const me = upsilon.currentCharacter();
        try {
            upsilon.call("game_action", { id: sharedMatchId, type: "pass", entity_id: me.id });
        } catch (e) {
            // Bot 1 may have just forfeited (the exact behaviour under test)
            // between our waitNextTurn() wakeup and this call -- the arena is
            // then legitimately gone. Anything else is a real failure.
            const key = (e && e.error_key) || (e && e.key) || "";
            if (key === "arena.notfound" || key === "game.not.in.progress") {
                upsilon.log(`[Bot-${agentIndex}] Match already concluded (bot 1 forfeited) — exiting.`);
                break;
            }
            throw e;
        }
    }
}

upsilon.log(`[Bot-${agentIndex}] EC-35: FORFEIT OUT OF TURN PASSED.`);
