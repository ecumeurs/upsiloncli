// upsiloncli/tests/scenarios/edge_skill_unowned_character_roll.js
// @test-link [[api_character_skill_inventory]]
// @test-link [[rule_character_skill_slots]]
//
// Validates that a player cannot roll a skill for a character they do not own.

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

// Register attacker (different account)
const attackerName = "attacker_" + botId;
upsilon.bootstrapBot(attackerName, password);

// Attacker tries to roll a skill for owner's character
try {
    upsilon.call("skill_roll", { characterId: ownerCharId });
    upsilon.assert(false, "ERROR: Rolling for another player's character must be rejected");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Roll on foreign character rejected: ${e.message}`);
    upsilon.assertResponse(e, 403, "unauthorized");
}

upsilon.log(`[Bot-${agentIndex}] EC: SKILL ROLL UNOWNED CHARACTER PASSED.`);
