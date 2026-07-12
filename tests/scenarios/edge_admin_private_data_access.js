// upsiloncli/tests/scenarios/edge_admin_private_data_access.js
// @test-link [[upsilonapi:rule_admin_access_restriction]]
//
// ISS-107 audit (EC-49) rewrite. The original scenario tried to prove a
// REGULAR (non-admin) account gets a live 403 calling upsilon.call("admin_users",
// {}) directly. That edge is structurally unreachable via this CLI: any
// "admin_"-prefixed route is hard-blocked client-side outside
// upsilon.adminSection() (internal/script/bridge.go:109-111), and
// adminSection() always authenticates as the real seeded admin — there is no
// scripting path to call an admin route AS a non-admin. Confirmed live
// (deterministic "security error: route 'admin_users' is administrative..."
// harness message, never reaches the network). This is the exact mechanism
// ISS-112 already documents for edge_auth_non_admin_access (EC-17); that
// half of this scenario is a duplicate of ISS-112, not a fresh issue, and is
// ALREADY covered at the Go layer by TestNonAdminCannotReachAdminRoutes
// (upsilonhub/internal/gateway/admin_users_test.go:127-137) — no CLI-level
// substitute is added here for it.
//
// What IS reachable via this CLI is the atom's actual documented content:
// [[upsilonapi:rule_admin_access_restriction]]'s real logic is "admins MUST
// NOT see full_address/birth_date" (censor/omit) — a DIFFERENT rule than
// the route-authorization gate its own @spec-link on RequireAdmin()
// (middleware/auth.go:90) suggests; that spec-link is bound to the wrong
// code (flagged, not changed here — see ISS-116). Admins CAN reach
// admin_users via upsilon.adminSection(), so this scenario pins the atom's
// real edge directly: register a user with known private fields, list them
// as admin, and assert those fields are censored.
//
// EXPECTED TO FAIL TODAY: verified live (3/3 runs) that upsilonhub's
// newUserJSON (gateway/resources.go:55) is a single context-blind
// serializer reused for self-profile AND admin views — it never censors
// anything; the admin listing returns full_address/birth_date in plaintext.
// Real production bug, not a test bug — filed as ISS-116. Left as a strict
// (red) assertion rather than softened, per this audit's precedent
// (edge_char_reroll_post_match / ISS-113): the suite is reporting-only
// during the ISS-107 audit, so an honest red beats a silent false green.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;

upsilon.log(`[Bot-${agentIndex}] Starting EC-49: Admin Private Data Access`);

// 1. Register a regular (non-admin) account carrying known private fields.
const accountName = "privdata_bot_" + botId;
const password = "VerySecurePassword123!";
const secretAddress = "999 Secret Lane, Bot-" + botId;
const secretBirthDate = "1990-01-01T00:00:00Z";

const regResponse = upsilon.call("auth_register", {
    account_name: accountName,
    email: accountName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: secretAddress,
    birth_date: secretBirthDate
});

upsilon.assert(regResponse.user != null, "Registration failed");

// Cleanup — registered before the privacy assertions below: they are
// expected RED today (ISS-116), and a teardown registered after them would
// never run, orphaning this account every run.
upsilon.onTeardown(() => {
    try {
        upsilon.call("auth_delete", {});
        upsilon.log(`[Bot-${agentIndex}] Account cleaned up`);
    } catch (e) {
        upsilon.log(`Teardown cleanup error (ignored): ${e.message}`);
    }
});

upsilon.assertEquals(regResponse.user.full_address, secretAddress, "Setup: registration should echo full_address back to the owner");
upsilon.log(`[Bot-${agentIndex}] Registered account with private data: ${accountName}`);

// 2. As admin, list the user registry and locate this account. admin_users
// takes no search param client-side (endpoint/admin.go:22), so scan the
// (recent-first, ORDER BY updated_at DESC) first page for it.
let found = null;
upsilon.adminSection((admin) => {
    const page = admin.call("admin_users", {});
    const items = (page && page.items) || [];
    for (const item of items) {
        if (item.account_name === accountName) {
            found = item;
            break;
        }
    }
});

upsilon.assert(found != null, `ERROR: freshly registered account '${accountName}' not found on the admin_users first page`);

// 3. Pin rule_admin_access_restriction's real content: admins must not see
// full_address/birth_date in plaintext. Currently fails — ISS-116.
upsilon.assert(
    found.full_address !== secretAddress,
    `PRIVACY VIOLATION (ISS-116): admin_users exposed the raw full_address '${found.full_address}' to an administrator`
);
upsilon.assert(
    found.birth_date !== "1990-01-01",
    `PRIVACY VIOLATION (ISS-116): admin_users exposed the raw birth_date '${found.birth_date}' to an administrator`
);

// Cleanup
upsilon.onTeardown(() => {
    try {
        upsilon.call("auth_delete", {});
        upsilon.log(`[Bot-${agentIndex}] Account cleaned up`);
    } catch (e) {
        upsilon.log(`Teardown cleanup error (ignored): ${e.message}`);
    }
});

upsilon.log(`[Bot-${agentIndex}] EC-49: ADMIN PRIVATE DATA ACCESS CHECK COMPLETE.`);
