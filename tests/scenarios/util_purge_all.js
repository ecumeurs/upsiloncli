// upsiloncli/tests/scenarios/util_purge_all.js
upsilon.log("PURGING ALL MATCHES AND DATA...");

try {
    upsilon.call("admin_login", {
        account_name: "admin",
        password: "AdminPassword123!"
    });
    upsilon.call("admin_history_purge", {});
    upsilon.log("PURGE COMPLETE.");
} catch (e) {
    upsilon.log("PURGE FAILED: " + e.message);
}
