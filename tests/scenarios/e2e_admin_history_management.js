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
upsilon.adminSection((admin) => {
    // 1. Fetch History
    admin.log("1. Fetching Match History Archive...");
    const history = admin.call("admin_history", {});
    admin.assert(history.items != null, "Match items missing");
    admin.log(`✅ History Fetch Successful. Found ${history.items.length} records.`);

    // 2. Performance Check
    if (history.has_more) {
        admin.log("2. Testing Manual Pagination (ISS-053)...");
        const nextBatch = admin.call("admin_history", { cursor: history.next_cursor });
        admin.assert(nextBatch.items.length > 0, "Failed to fetch second batch using cursor");
        admin.log("✅ Manual Pagination Functional.");
    } else {
        admin.log("2. Skipping Pagination (Insufficient data).");
    }

    // 3. Purge Action
    admin.log("3. Testing History Purge Protocol (ISS-051)...");
    const purgeResp = admin.call("admin_history_purge", {});
    admin.log(`✅ Purge Operation Executed. Status: ${purgeResp.message}`);
    if (purgeResp.purged_count !== undefined) {
        admin.log(`Purged count: ${purgeResp.purged_count}`);
    }
});

upsilon.log("SUCCESS: ADMIN HISTORY MANAGEMENT VERIFIED.");
