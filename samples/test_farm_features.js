// test_farm_features.js

upsilon.onTeardown(() => {
    upsilon.log("TEARDOWN: Cleaning up agent resources...");
});

upsilon.log("Testing Assert...");
upsilon.assert(true, "This should pass");

try {
    upsilon.log("Testing Assert Failure (expect exception)...");
    upsilon.assert(1 === 2, "Intentional failure");
} catch (e) {
    upsilon.log("Success: Caught expected assertion failure: " + e);
}

upsilon.log("Testing Shared Memory...");
upsilon.setShared("global_val", "12345");
let val = upsilon.getShared("global_val");
upsilon.assert(val === "12345", "Shared memory set/get failed in same agent");

upsilon.log("Testing Sleep (200ms)...");
upsilon.sleep(200);

upsilon.log("Verification script finished.");
