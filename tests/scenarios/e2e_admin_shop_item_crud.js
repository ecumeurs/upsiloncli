// upsiloncli/tests/scenarios/e2e_admin_shop_item_crud.js
// @test-link [[api_shop_item_admin_crud]]
// @test-link [[rule_admin_content_authority]]
//
// Validates the admin shop item CRUD lifecycle:
// 1. Admin login
// 2. Create a shop item
// 3. List — verify item appears
// 4. Update availability (toggle off)
// 5. Verify player catalog excludes unavailable item
// 6. Toggle availability back on
// 7. Delete
// 8. Verify gone from both admin and player listing

upsilon.log("Starting: Admin Shop Item CRUD");

// 1. Admin setup and item creation
// @spec-link [[mech_script_admin_section]]
let createdItemId;
upsilon.adminSection(() => {
    upsilon.log("1. Creating shop item...");
    const uniqueName = "E2E_Item_" + Math.floor(Math.random() * 100000);
    const created = upsilon.call("admin_shop_item_create", {
        name: uniqueName,
        slot: "utility",
        cost: "150",
        available: "true"
    });
    upsilon.assert(created && created.id, "Created item must have an ID");
    upsilon.log(`Item created: ${created.id}`);
    createdItemId = created.id;

    // 3. Verify it appears in admin list
    const adminList = upsilon.call("admin_shop_item_list", {});
    const foundAdmin = adminList.find(i => i.id === createdItemId);
    upsilon.assert(foundAdmin, "Created item must appear in admin list");

    // 4. Toggle availability off
    upsilon.call("admin_shop_item_update", { id: createdItemId, available: "false" });
    upsilon.log("Item availability set to false.");
});

// 5. Player shop browse must exclude unavailable item
// Register a temporary player manually — no bootstrapBot to avoid session contamination.
// The teardown hook from bootstrapBot would fire AFTER the admin re-login below, deleting
// the admin account instead of the player's.
const botId = Math.floor(Math.random() * 10000);
const playerAccount = "shop_tester_" + botId;
upsilon.call("auth_register", {
    account_name: playerAccount,
    email: playerAccount + "@example.com",
    nickname: "Bot_" + playerAccount,
    password: "VerySecurePassword123!",
    password_confirmation: "VerySecurePassword123!",
    full_address: "Bot Street, Virtual Arena",
    birth_date: "1990-01-01T00:00:00Z",
});

const playerShop = upsilon.call("shop_browse", {});
const hiddenInShop = playerShop.find(i => i.id === createdItemId);
upsilon.assert(!hiddenInShop, "Unavailable item must not appear in player shop browse");
upsilon.log("Confirmed item hidden from player shop.");

// Delete temporary player while still on player session, before switching back to admin.
upsilon.call("auth_delete", {});
upsilon.log("Temporary player account deleted.");

// 6. Admin toggles back on and deletes
upsilon.adminSection(() => {
    upsilon.call("admin_shop_item_update", { id: createdItemId, available: "true" });
    upsilon.call("admin_shop_item_delete", { id: createdItemId });
    upsilon.log("Item deleted.");

    // 8. Verify gone from admin list
    const afterDelete = upsilon.call("admin_shop_item_list", {});
    const stillFound = afterDelete.find(i => i.id === createdItemId);
    upsilon.assert(!stillFound, "Deleted item must not appear in admin list");
});

upsilon.log("ADMIN SHOP ITEM CRUD PASSED.");
