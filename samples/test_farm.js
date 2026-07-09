upsilon.log("Bot starting...");

// /api/v1/help is retired; the CLI ships a static route registry instead.
// Smoke-test the API with an authenticated read instead of discovery.
const botId = Math.floor(Math.random() * 10000);
upsilon.bootstrapBot("farm_sample_" + botId, "VerySecurePassword123!");

var stats = upsilon.call("stats_waiting", {});
if (stats) {
    upsilon.log("Waiting stats retrieved successfully.");
} else {
    upsilon.log("Failed to retrieve waiting stats.");
}

upsilon.log("Waiting for a dummy event (should timeout)...");
try {
    upsilon.waitForEvent("dummy_event", 1000);
} catch (e) {
    upsilon.log("Caught expected timeout: " + e);
}

upsilon.log("Test finished.");
</content>
</invoke>
