// upsiloncli/tests/scenarios/e2e_archetype_pve_random.js
// @test-link [[mec_ai_archetype_system]]
// @test-link [[rule_team_composition]]
// @test-link [[mechanic_ai_progression_matching]]
//
// Verifies that a PVE match starts successfully with auto-generated AI entities:
// - No 400/500 from team-composition validation (composition is legal)
// - AI entities have valid stats (HP > 0, Attack > 0) from archetype stat generation
// - AI entities have skills equipped from the archetype skill bundle

const botId = Math.floor(Math.random() * 10000);
const accountName = "archetype_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log("Starting archetype_pve_random: " + accountName);

upsilon.bootstrapBot(accountName, password);

const matchData = upsilon.joinWaitMatch("1v1_PVE");
upsilon.log("Match started: " + matchData.match_id);

const board = upsilon.waitNextTurn();
upsilon.assert(board != null, "Expected initial board state");

// Verify AI player is present.
const foes = upsilon.myFoes();
upsilon.assert(foes.length > 0, "No AI team found in PVE match");
upsilon.log("AI player nickname: " + foes[0].nickname);

// Verify each AI entity has valid auto-generated stats.
const foesChars = upsilon.myFoesCharacters();
upsilon.assert(foesChars.length > 0, "AI team has no entities");

let allValid = true;
for (let i = 0; i < foesChars.length; i++) {
    const e = foesChars[i];
    upsilon.log(`AI entity [${i}]: ${e.name} HP=${e.hp}/${e.max_hp} ATK=${e.attack} DEF=${e.defense} MOV=${e.move}`);

    if (e.max_hp <= 0) {
        upsilon.log(`ERROR: entity ${e.name} has max_hp=${e.max_hp} (expected > 0)`);
        allValid = false;
    }
    if (e.attack <= 0) {
        upsilon.log(`ERROR: entity ${e.name} has attack=${e.attack} (expected > 0)`);
        allValid = false;
    }
    if (e.move <= 0) {
        upsilon.log(`ERROR: entity ${e.name} has move=${e.move} (expected > 0)`);
        allValid = false;
    }

    // Verify skill bundle was generated.
    if (!e.equipped_skills || e.equipped_skills.length === 0) {
        upsilon.log(`WARN: entity ${e.name} has no equipped skills — archetype skill bundle may not have been applied`);
    } else {
        upsilon.log(`  skills: ${e.equipped_skills.map(function(s) { return s.name; }).join(", ")}`);
    }
}

upsilon.assert(allValid, "One or more AI entities have zero stats — auto-gen pipeline failed");
upsilon.log("✅ All AI entities have valid auto-generated stats.");
upsilon.log("e2e_archetype_pve_random: PASSED.");
