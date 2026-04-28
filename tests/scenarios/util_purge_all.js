// upsiloncli/tests/scenarios/util_purge_all.js
upsilon.log("PURGING ALL MATCHES AND DATA...");

// @spec-link [[mech_script_admin_section]]
upsilon.adminSection(() => {
    upsilon.call("admin_history_purge", {});
    upsilon.log("PURGE COMPLETE.");
});
