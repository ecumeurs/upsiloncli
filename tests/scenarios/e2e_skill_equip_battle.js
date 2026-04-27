// upsiloncli/tests/scenarios/e2e_skill_equip_battle.js
// @test-link [[api_character_skill_inventory]]
// @test-link [[rule_character_skill_slots]]
// @test-link [[api_matchmaking]]
//
// Validates the full skill equip → battle flow:
// 1. Roll a skill and equip it on the character
// 2. Verify character skill list shows equipped=true
// 3. Join a PvE match
// 4. Assert match starts successfully with the skilled entity

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "skill_fighter_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting: Skill Equip → Battle`);

// 1. Setup
upsilon.bootstrapBot(accountName, password);

const profile = upsilon.call("profile_get", {});
upsilon.assert(profile.characters && profile.characters.length > 0, "Bot must have at least one character");
const charId = profile.characters[0].id;

// 2. Roll & Equip
const acquired = upsilon.call("skill_roll", { characterId: charId });
upsilon.assert(acquired && acquired.id, "Roll must return a skill");

const equipped = upsilon.call("skill_equip", { characterId: charId, skillId: acquired.id });
upsilon.assert(equipped && equipped.equipped, "Equip must return the skill with equipped=true");
upsilon.assertEquals(equipped.id, acquired.id, "Equipped skill ID must match rolled skill");

upsilon.log(`[Bot-${agentIndex}] Skill equipped: ${acquired.id}`);

// 3. Verify inventory state
const skills = upsilon.call("character_skill_list", { characterId: charId });
const equippedSkill = skills.find(s => s.id === acquired.id);
upsilon.assert(equippedSkill, "Equipped skill must appear in character skill list");
upsilon.assert(equippedSkill.equipped, "Skill must be marked equipped=true in inventory");

// 4. Battle — verify the match starts without error (bridge must send skill to engine)
upsilon.log(`[Bot-${agentIndex}] Joining PvE match with equipped skill...`);
const matchData = upsilon.joinWaitMatch("1v1_PVE");
upsilon.assert(matchData && matchData.match_id, "Must be matched into a PvE game");
upsilon.assertEquals(matchData.game_mode, "1v1_PVE", "Game mode must be 1v1_PVE");

const board = upsilon.waitNextTurn();
upsilon.assert(board != null, "Must receive initial board state");

const myPlayer = board.players.find(p => p.is_self);
upsilon.assert(myPlayer, "Own player must be present in board state");
const me = myPlayer.entities.find(e => e.id === charId);
upsilon.assert(me, "Skilled character must be present in the match entity list");

upsilon.log(`[Bot-${agentIndex}] SKILL EQUIP → BATTLE PASSED.`);
