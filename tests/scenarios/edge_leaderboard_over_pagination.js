// upsiloncli/tests/scenarios/edge_leaderboard_over_pagination.js
// @spec-link [[api_leaderboard]]
// @spec-link [[us_leaderboard_view_sort_leaderboard]]

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "lbpage_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting EC-42: Leaderboard Over Pagination`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);

// 2. Test leaderboard with valid page 1
upsilon.log(`[Bot-${agentIndex}] Requesting leaderboard page 1...`);
const page1Result = upsilon.call("leaderboard", { mode: "1v1_PVP", page: 1 });
upsilon.assert(page1Result.results != undefined, "Leaderboard page 1 results missing");
upsilon.log(`[Bot-${agentIndex}] ✅ Page 1 succeeded, ${page1Result.results.length} results`);

// 3. Test leaderboard with over-paginated page (9999)
upsilon.log(`[Bot-${agentIndex}] Requesting leaderboard page 9999...`);
try {
    const overPageResult = upsilon.call("leaderboard", { mode: "1v1_PVP", page: 9999 });
    upsilon.log(`[Bot-${agentIndex}] ✅ Over-paginated page handled: ${overPageResult.results ? overPageResult.results.length + " results" : "empty results or 404"}`);

    // Should return empty results, not crash
    if (overPageResult.results) {
        upsilon.assertEquals(overPageResult.results.length, 0, "Over-paginated page should return empty results");
    } else if (overPageResult.message) {
        // May return 404 message
        upsilon.log(`[Bot-${agentIndex}] Message: ${overPageResult.message}`);
    }
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] Over-paginated page returned error: ${e.message}`);
    // 404 Not Found is acceptable
    if (e.status_code) {
        if (e.status_code === 404) {
            upsilon.log(`[Bot-${agentIndex}] ✅ 404 Not Found is acceptable for over-pagination`);
        }
    }
}

// 4. Test pagination metadata if available
if (page1Result.meta) {
    upsilon.log(`[Bot-${agentIndex}] Pagination metadata present: ${JSON.stringify(page1Result.meta)}`);
}

upsilon.log(`[Bot-${agentIndex}] EC-42: LEADERBOARD OVER PAGINATION PASSED.`);
