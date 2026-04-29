// upsiloncli/tests/scenarios/util_purge_all.js
upsilon.log("PURGING ALL MATCHES AND DATA...");

// @spec-link [[mech_script_admin_section]]
upsilon.adminSection((admin) => {
    admin.call("admin_history_purge", {});
    admin.log("PURGE COMPLETE.");
});
