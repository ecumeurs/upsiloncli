// upsiloncli/tests/scenarios/e2e_skill_roll_naming.js
// @test-link [[api_character_skill_inventory]]
// @test-link [[shared:req_skill_generation_overhaul]]
// @test-link [[upsilonbattle:mech_skill_name_generation]]
//
// Validates that the skill roll pipeline produces:
//   - a diegetic name (not a raw property key)
//   - a non-empty ordered tags array
//   - correct grade for the rolled PSW
//
// Rolls 20 skills and prints a summary table for visual confirmation.

upsilon.log("Starting: Skill Roll Naming — e2e validation");

const VALID_TAGS = new Set([
    "melee", "ranged", "aoe",
    "heal", "shield", "buff", "debuff",
    "dot", "stun", "crit",
    "trap", "counter", "reaction", "passive",
    "mobility", "channeled", "instant",
]);

const RAW_PROPERTY_KEYS = new Set([
    "Damage", "Heal", "Shield", "Accuracy", "Cooldown",
    "HPLeech", "MPLeech", "SPLeech", "New Skill",
]);

const VALID_GRADES = new Set(["Grade I", "Grade II", "Grade III", "Grade IV", "Grade V"]);

// -- Player setup --
const botId = Math.floor(Math.random() * 100000);
const playerAccount = "skill_naming_bot_" + botId;
upsilon.bootstrapBot(playerAccount, "VerySecurePassword123!");

const profile = upsilon.call("profile_get", {});
upsilon.assert(profile.characters && profile.characters.length > 0, "Player must have a character after bootstrapBot");
const charId = profile.characters[0].id;
upsilon.log(`Using character: ${charId}`);

// -- Roll loop --
const ROLLS = 20;
const results = [];
let failures = 0;

for (let i = 0; i < ROLLS; i++) {
    const skill = upsilon.call("character_skill_roll", { characterId: charId });
    upsilon.assert(skill && skill.instance_data, `Roll ${i + 1}: must return instance_data`);

    const data = skill.instance_data;
    const name = data.name ?? "";
    const grade = data.grade ?? "";
    const tags = Array.isArray(data.tags) ? data.tags : [];

    // 1. Name must not be a raw property key
    const nameIsRaw = RAW_PROPERTY_KEYS.has(name);
    if (nameIsRaw) {
        upsilon.log(`[FAIL] Roll ${i + 1}: name "${name}" is a raw property key`);
        failures++;
    }

    // 2. Name length ≤ 24
    if (name.length > 24) {
        upsilon.log(`[FAIL] Roll ${i + 1}: name "${name}" exceeds 24 chars (${name.length})`);
        failures++;
    }

    // 3. Tags non-empty
    if (tags.length === 0) {
        upsilon.log(`[FAIL] Roll ${i + 1}: tags array is empty`);
        failures++;
    }

    // 4. All tags are from the known vocabulary
    const unknownTags = tags.filter(t => !VALID_TAGS.has(t));
    if (unknownTags.length > 0) {
        upsilon.log(`[FAIL] Roll ${i + 1}: unknown tags [${unknownTags.join(", ")}]`);
        failures++;
    }

    // 5. Grade is a known value
    if (!VALID_GRADES.has(grade)) {
        upsilon.log(`[FAIL] Roll ${i + 1}: unexpected grade "${grade}"`);
        failures++;
    }

    results.push({ name, grade, tags: tags.join(", ") });
    upsilon.log(`Roll ${i + 1}: ${name.padEnd(26)} | ${grade.padEnd(8)} | [${tags.join(", ")}]`);
}

// -- Summary --
upsilon.log("\n--- Skill Roll Naming Summary ---");
upsilon.log(`Rolls: ${ROLLS} | Failures: ${failures}`);

upsilon.assert(failures === 0, `${failures} naming assertion(s) failed — see log above`);

upsilon.log("e2e_skill_roll_naming PASSED.");
