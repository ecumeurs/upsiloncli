// upsiloncli/tests/scenarios/edge_leaderboard_over_pagination.js
// @test-link [[upsilonapi:api_leaderboard]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "lbpage_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-42: Leaderboard Over Pagination`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);

// 2. Baseline: page 1 sanity check.
upsilon.log(`[Bot-${agentIndex}] Requesting leaderboard page 1...`);
const page1Result = upsilon.call("leaderboard", { mode: "1v1_PVP", page: 1 });
upsilon.assert(page1Result.results != undefined, "Leaderboard page 1 results missing");
upsilon.log(`[Bot-${agentIndex}] ✅ Page 1 succeeded, ${page1Result.results.length} results`);

// 3. Over-paginated page (9999). leaderboard.go's index() never errors or
// 404s on an out-of-range page: `start := (page-1)*leaderboardPerPage` simply
// exceeds `len(ranked)`, so `paginated` stays the zero-value `[]`. The call
// always succeeds (200), so no try/catch is needed here — wrapping it would
// hide a real regression (e.g. a future out-of-range page erroring) behind a
// silently-passing catch block.
upsilon.log(`[Bot-${agentIndex}] Requesting leaderboard page 9999...`);
const overPageResult = upsilon.call("leaderboard", { mode: "1v1_PVP", page: 9999 });

upsilon.assertEquals(overPageResult.results.length, 0, "Over-paginated page should return empty results");
upsilon.assertEquals(overPageResult.meta.current_page, 9999, "meta.current_page should echo the requested page verbatim, not clamp to the last valid page");
upsilon.assertEquals(overPageResult.meta.total, page1Result.meta.total, "meta.total must reflect the full ranked set regardless of which page was requested");
upsilon.assertEquals(overPageResult.meta.last_page, page1Result.meta.last_page, "meta.last_page must reflect the full ranked set regardless of which page was requested");
upsilon.log(`[Bot-${agentIndex}] ✅ Over-paginated page returned empty results with correct pagination metadata: ${JSON.stringify(overPageResult.meta)}`);

upsilon.log(`[Bot-${agentIndex}] EC-42: LEADERBOARD OVER PAGINATION PASSED.`);
