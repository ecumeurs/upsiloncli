// upsiloncli/tests/scenarios/edge_skill_unowned_character_roll.js
// @test-link [[upsilonapi:api_character_skill_inventory]]
//
// Validates that a player cannot roll a skill for a character they do not
// own: the attacker's roll call can only fail on the character-ownership
// check in skillsAPI.ownedCharacter (skills.go), shared by every skill
// route (roll/equip/unequip/list) — "This action is unauthorized." (403),
// which fires before the roll body (grade gate, engine call) ever runs.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const password = "VerySecurePassword123!";

// Register owner and capture their character ID
const ownerName = "owner_" + botId;
upsilon.bootstrapBot(ownerName, password);
const ownerProfile = upsilon.call("profile_get", {});
upsilon.assert(ownerProfile.characters && ownerProfile.characters.length > 0, "Owner must have a character");
const ownerCharId = ownerProfile.characters[0].id;
upsilon.log(`[Bot-${agentIndex}] Owner character: ${ownerCharId}`);

// Register attacker — plain register (not bootstrapBot: a second
// bootstrapBot call in the same agent overwrites the single teardown-hook
// slot, permanently orphaning the owner account; see ISS-114).
const attackerName = "attacker_" + botId;
upsilon.call("auth_register", {
    account_name: attackerName,
    email: attackerName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: "Test",
    birth_date: "1990-01-01T00:00:00Z"
});
upsilon.call("auth_login", { account_name: attackerName, password: password });

// Attacker tries to roll a skill for owner's character
try {
    upsilon.call("character_skill_roll", { characterId: ownerCharId });
    upsilon.assert(false, "ERROR: Rolling for another player's character must be rejected");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Roll on foreign character rejected: ${e.message} (Status: ${e.status})`);
    upsilon.assertResponse(e, 403, "This action is unauthorized.");
}

// Switch back to owner so bootstrapBot's teardown hook (a single-slot
// closure — see ISS-114) cleans up the account it was actually installed
// for, rather than whichever account happens to be authenticated at
// script end.
upsilon.call("auth_login", { account_name: ownerName, password: password });

upsilon.log(`[Bot-${agentIndex}] EC: SKILL ROLL UNOWNED CHARACTER PASSED.`);
