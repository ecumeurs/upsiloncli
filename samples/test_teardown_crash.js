// test_teardown_crash.js

upsilon.onTeardown(() => {
    upsilon.log("TEARDOWN: This MUST run even on crash!");
});

upsilon.log("Forcing a crash with unhandled assertion failure...");
upsilon.assert(false, "UNHANDLED CRASH");
upsilon.log("This line should NEVER be reached.");
