// upsiloncli/tests/scenarios/edge_skill_unowned_character_equip.js
// @test-link [[api_character_skill_inventory]]
//
// Validates that a player cannot equip a skill on a character they do not own.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const password = "VerySecurePassword123!";

// Register owner — roll a skill on their character
const ownerName = "owner_eq_" + botId;
upsilon.bootstrapBot(ownerName, password);
const ownerProfile = upsilon.call("profile_get", {});
const ownerCharId = ownerProfile.characters[0].id;
const ownerSkill = upsilon.call("skill_roll", { characterId: ownerCharId });
upsilon.assert(ownerSkill && ownerSkill.id, "Owner must be able to roll a skill");
upsilon.log(`[Bot-${agentIndex}] Owner character: ${ownerCharId}, skill: ${ownerSkill.id}`);

// Register attacker
const attackerName = "attacker_eq_" + botId;
upsilon.bootstrapBot(attackerName, password);

// Attacker tries to equip on owner's character (using owner's skill ID)
try {
    upsilon.call("skill_equip", { characterId: ownerCharId, skillId: ownerSkill.id });
    upsilon.assert(false, "ERROR: Equipping on another player's character must be rejected");
} catch (e) {
    upsilon.log(`[Bot-${agentIndex}] ✅ Equip on foreign character rejected: ${e.message}`);
    upsilon.assert(
        e.message.includes("403") || e.message.includes("404"),
        "Must be 403 Forbidden or 404"
    );
}

upsilon.log(`[Bot-${agentIndex}] EC: SKILL EQUIP UNOWNED CHARACTER PASSED.`);
