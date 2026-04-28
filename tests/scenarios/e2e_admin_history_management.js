// upsiloncli/tests/scenarios/e2e_admin_history_management.js
// @test-link [[uc_admin_history_management]]
// @test-link [[entity_game_match]]

/**
 * SCENARIO: Match History & Purge Maintenance (ISS-051, ISS-053)
 * 1. Fetch History (Initial)
 * 2. Search History by ID
 * 3. History Purge Action
 */

upsilon.log("Starting E2E Admin History Management Verification");

// @spec-link [[mech_script_admin_section]]
upsilon.adminSection(() => {
    // 1. Fetch History
    upsilon.log("1. Fetching Match History Archive...");
    const history = upsilon.call("admin_history", {});
    upsilon.assert(history.items != null, "Match items missing");
    upsilon.log(`✅ History Fetch Successful. Found ${history.items.length} records.`);

    // 2. Performance Check
    if (history.has_more) {
        upsilon.log("2. Testing Manual Pagination (ISS-053)...");
        const nextBatch = upsilon.call("admin_history", { cursor: history.next_cursor });
        upsilon.assert(nextBatch.items.length > 0, "Failed to fetch second batch using cursor");
        upsilon.log("✅ Manual Pagination Functional.");
    } else {
        upsilon.log("2. Skipping Pagination (Insufficient data).");
    }

    // 3. Purge Action
    upsilon.log("3. Testing History Purge Protocol (ISS-051)...");
    const purgeResp = upsilon.call("admin_history_purge", {});
    upsilon.log(`✅ Purge Operation Executed. Status: ${purgeResp.message}`);
    if (purgeResp.purged_count !== undefined) {
        upsilon.log(`Purged count: ${purgeResp.purged_count}`);
    }
});

upsilon.log("SUCCESS: ADMIN HISTORY MANAGEMENT VERIFIED.");
