// upsiloncli/tests/scenarios/e2e_api_discovery.js
// @test-link [[requirement_customer_api_first]]
// @test-link [[api_help_endpoint]]

/**
 * SCENARIO: CR-17 API Self-Discovery
 * EXPECTED BEHAVIOR:
 * 1. Unauthenticated client calls /api/v1/help
 * 2. System returns a JSON object containing:
 *    - all available routes
 *    - methods, parameters, and descriptions
 * 3. Registry helps developers integrate without external docs.
 */

upsilon.log("Starting CR-17: API Self-Discovery Verification");

try {
    upsilon.log("Checking help endpoint...");
    const registry = upsilon.call("api_help", {});
    
    upsilon.log("✅ API Registry found! Validating structure...");
    upsilon.assert(Array.isArray(registry) || typeof registry === 'object', "Registry should be a collection");
} catch (e) {
    // FAIL DIRECTLY AS NOT IMPLEMENTED as per user request
    upsilon.log("❌ CR-17 FAILED: API Help/Discovery endpoint 'api_help' not implemented.");
    upsilon.log("Expected: HTTP 200 with structured API registry.");
    upsilon.log("Actual: " + e.message);
    upsilon.assert(false, "FEATURE NOT IMPLEMENTED: [[api_help_endpoint]]");
}
