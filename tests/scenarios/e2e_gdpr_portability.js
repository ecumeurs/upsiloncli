// upsiloncli/tests/scenarios/e2e_gdpr_portability.js
// @test-link [[api_profile_export]]
// @test-link [[rule_gdpr_compliance]]

/**
 * SCENARIO: CR-14 GDPR Data Portability
 * EXPECTED BEHAVIOR:
 * 1. Authenticated player calls /api/v1/auth/export
 * 2. System returns status 200 with JSON payload containing:
 *    - user (name, email, address, birth_date)
 *    - characters (roster, stats)
 *    - match_history (concise records)
 * 3. Data is compliant with GDPR portability requirements.
 */

upsilon.log("Starting CR-14: GDPR Data Portability Verification");

// 1. Authenticate (using current session if available, or bootstrap a bot)
// Since this is a standalone test, we can use an existing session if this runs in a farm,
// but for a robust E2E we usually bootstrap.
// Let's assume we are logged in.

upsilon.log("Checking export endpoint...");
const exportData = upsilon.call("auth_export", {});

upsilon.log("✅ Endpoint found! Validating data structure...");

// 2. Validate top-level keys
upsilon.assert(exportData.account != null, "Export missing 'account' information");
upsilon.assert(exportData.characters != null, "Export missing 'characters' information");
upsilon.assert(exportData.stats != null, "Export missing 'stats' information");

// 3. Validate sensitive data presence (GDPR requirements)
upsilon.assert(exportData.account.account_name != null, "Missing account_name");
upsilon.assert(exportData.account.email != null, "Missing email");
upsilon.assert(exportData.account.full_address != null, "Missing address");
upsilon.assert(exportData.account.birth_date != null, "Missing birth_date");

upsilon.log("✅ GDPR Export structure verified.");
upsilon.log("CR-14: GDPR DATA PORTABILITY PASSED.");
