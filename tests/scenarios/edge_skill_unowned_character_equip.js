// upsiloncli/tests/scenarios/edge_skill_unowned_character_equip.js
// @test-link [[upsilonapi:api_character_skill_inventory]]
//
// Validates that a player cannot equip a skill on a character they do not
// own: the skill genuinely exists on the owner's own character, so the only
// way the attacker's equip call can fail is the character-ownership check
// in skillsAPI.ownedCharacter (skills.go) — "This action is unauthorized."
// (403), which fires before skill resolution ever runs.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const password = "VerySecurePassword123!";

// Register owner — roll a skill on their character
const ownerName = "owner_eq_" + botId;
upsilon.bootstrapBot(ownerName, password);
const ownerProfile = upsilon.call("profile_get", {});
const ownerCharId = ownerProfile.characters[0].id;
const ownerSkill = upsilon.call("character_skill_roll", { characterId: ownerCharId });
upsilon.assert(ownerSkill && ownerSkill.id, "Owner must be able to roll a skill");
upsilon.log(`[Bot-${agentIndex}] Owner character: ${ownerCharId}, skill: ${ownerSkill.id}`);

// Register attacker — plain register (not bootstrapBot: a second
// bootstrapBot call in the same agent overwrites the single teardown-hook
// slot, permanently orphaning the owner account; see ISS-114).
const attackerName = "attacker_eq_" + botId;
upsilon.call("auth_register", {
    account_name: attackerName,
    email: attackerName + "@example.com",
    password: password,
    password_confirmation: password,
    full_address: "Test",
    birth_date: "1990-01-01T00:00:00Z"
});
upsilon.call("auth_login", { account_name: attackerName, password: password });

// Attacker tries to equip on owner's character (using owner's skill ID)
try {
    upsilon.call("skill_equip", { characterId: ownerCharId, skillId: ownerSkill.id });
    upsilon.assert(false, "ERROR: Equipping on another player's character must be rejected");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Equip on foreign character rejected: ${e.message} (Status: ${e.status})`);
    upsilon.assertResponse(e, 403, "This action is unauthorized.");
}

// Switch back to owner so bootstrapBot's teardown hook (a single-slot
// closure — see ISS-114) cleans up the account it was actually installed
// for, rather than whichever account happens to be authenticated at
// script end.
upsilon.call("auth_login", { account_name: ownerName, password: password });

upsilon.log(`[Bot-${agentIndex}] EC: SKILL EQUIP UNOWNED CHARACTER PASSED.`);
