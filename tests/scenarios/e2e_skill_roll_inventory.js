// upsiloncli/tests/scenarios/e2e_skill_roll_inventory.js
// @test-link [[api_character_skill_inventory]]
// @test-link [[rule_character_skill_slots]]
// @test-link [[entity_character_skill_inventory]]
//
// Validates the skill roll (acquisition) flow:
// 1. Register a fresh player
// 2. Roll a skill for the character
// 3. Assert skill lands in inventory with source='roll'
// 4. Assert the skill list endpoint reflects the acquisition

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "skill_roller_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting: Skill Roll → Inventory`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);

const profile = upsilon.call("profile_get", {});
upsilon.assert(profile.characters && profile.characters.length > 0, "Bot must have at least one character");
const charId = profile.characters[0].id;

upsilon.log(`[Bot-${agentIndex}] Character: ${charId}`);

// 2. Roll
const acquired = upsilon.call("skill_roll", { characterId: charId });
upsilon.assert(acquired && acquired.id, "Roll must return a skill with an ID");
upsilon.assertEquals(acquired.source, "roll", "Acquired skill source must be 'roll'");
upsilon.assert(acquired.instance_data, "Acquired skill must have instance_data snapshot");
upsilon.assert(!acquired.equipped, "Newly rolled skill must start unequipped");

upsilon.log(`[Bot-${agentIndex}] Rolled skill: ${acquired.id}`);

// 3. Inventory reflection
const skills = upsilon.call("character_skill_list", { characterId: charId });
upsilon.assert(skills && skills.length === 1, `Character must have exactly 1 skill in inventory, got ${skills ? skills.length : 'null'}`);
upsilon.assertEquals(skills[0].id, acquired.id, "Inventory skill ID must match rolled skill");
upsilon.assertEquals(skills[0].source, "roll", "Inventory entry source must be 'roll'");

upsilon.log(`[Bot-${agentIndex}] SKILL ROLL → INVENTORY PASSED.`);
