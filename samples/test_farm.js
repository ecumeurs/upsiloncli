upsilon.log("Bot starting...");
var help = upsilon.call("api_help", {});
if (help) {
    upsilon.log("API Help retrieved successfully.");
} else {
    upsilon.log("Failed to retrieve API help.");
}

upsilon.log("Waiting for a dummy event (should timeout)...");
try {
    upsilon.waitForEvent("dummy_event", 1000);
} catch (e) {
    upsilon.log("Caught expected timeout: " + e);
}

upsilon.log("Test finished.");
