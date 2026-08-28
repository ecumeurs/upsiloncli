// upsiloncli/tests/scenarios/e2e_melee_attack_damage.js
// @test-link [[mech_combat_attack_computation]]
//
// ISS-141: positive-path coverage for the base melee `type: "attack"`
// action. Before this scenario, nothing in the suite asserted that a plain
// melee hit lands and deals damage — every edge_attack_* scenario asserts a
// REJECTION, and the positive-path fight scenarios (e2e_archetype_pve_full_fight,
// e2e_combat_turn_management) only assert that rounds were played. A
// regression that zeroed melee damage would have shipped fully green.
//
// Determinism note: reaching melee adjacency is the hard part. Board
// width/height are each rolled 5..15 tiles (mech_board_generation.atom.md),
// so a naive walk-and-melee setup reached adjacency in only 1 of 5 runs
// within an 80-round budget during earlier hardening work (see ISS-141).
// Two scenarios (edge_movement_already_attacked, edge_attack_target_out_of_grid)
// are already quarantined under ISS-110 for exactly this flakiness
// (run_all_edge_cases.sh:33-43) — this scenario must not become a third.
//
// To make adjacency, survival, and damage all deterministic, every character
// on the bot's team is granted a single "overkill" utility item before the
// match:
//   - Movement +10 (13/turn total against the default of 3) closes the
//     worst-case corner-to-corner gap on a 15x15 board (~30 tiles Manhattan)
//     in a small, bounded number of the bot's own turns — distance stops
//     being the constraint.
//   - HP +200 makes surviving long enough to reach adjacency a non-issue,
//     regardless of PVE roster strength or initiative order (the same
//     PVE-AI-initiative RNG that motivates the ISS-110 quarantines).
//   - Attack +1000 makes the resulting hit's magnitude unambiguous.
// One item carries all three properties — the three-slot system constrains
// equip slots, not property counts per item (proof: upsilonapi/bridge/equipment_test.go:24-26,
// and edge_attack_skill_cooldown.js:52 already stacks a single Defense
// property on a plain utility item). No skill_template_id is needed: this is
// a pure stat item, and this scenario deliberately issues no skill payload —
// only the base `type: "attack"` melee action is under test.
//
// Melee `type: "attack"` damage formula (upsilonbattle/battlearena/ruler/rules/attack.go):
//   totalAttack       = attacker.Attack + attacker.WeaponBaseDamage
//   effectiveDefense  = target.Defense + target.ArmorRating
//   multiplier        = 1.0 (1.5 if backstabbing, which also halves effectiveDefense)
//   computedDamage    = max(1, int(totalAttack * multiplier) - effectiveDefense)
//   Shield absorbs before HP: if target.Shield >= computedDamage, damage becomes 0.
// This is NOT the skill-tunnel formula used by e2e_credit_economy.js's
// Fireball (truedmg = max((attack*damage/100) - defense - armor, 0),
// effectapplicator.go) — that formula only applies to `type: "skill"` casts.
//
// Because computedDamage is floored at 1, asserting `damage > 0` would be
// nearly vacuous: any successful melee attack reports at least 1 even if the
// attacker's Attack stat never reached the formula, which is precisely the
// regression this scenario exists to catch. We instead assert a MAGNITUDE —
// damage > 500 — which only a real Attack of ~1000 flowing through the
// formula above can produce.
//
// A lethal hit is a valid pass (user ruling): Damage is populated into the
// ActionResult BEFORE the foeHP <= 0 entity-removal branch runs, so a kill
// still reports damage and new_hp may go negative. prev_hp/new_hp are
// therefore logged as diagnostics only — nothing is asserted on them.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "melee_bot_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting: Melee Attack Damage (ISS-141)`);

// 0. Bootstrap first so the roster size is known — one overkill item catalog
// entry per team member, mirroring e2e_credit_economy.js's per-character
// Fireball loop: items are not stackable across characters, so a shared shop
// item purchased N times yields one shared inventory row, not N independently
// equippable instances (pg_equipment.go: equipping detaches from any other
// character first). A distinct shop catalog entry per character is what
// actually produces N independently-equippable instances.
upsilon.bootstrapBot(accountName, password);
const rosterProfile = upsilon.call("profile_get", {});
upsilon.assert(rosterProfile.characters && rosterProfile.characters.length > 0, "Bot must have a character roster");

let overkillItemIds = [];
upsilon.adminSection((admin) => {
    admin.log("--- Admin Setup: one Overkill Kit catalog entry per team member ---");
    for (let i = 0; i < rosterProfile.characters.length; i++) {
        const item = admin.call("admin_shop_item_create", {
            name: `Overkill Kit #${i + 1}`,
            slot: "utility",
            cost: 0,
            available: true,
            properties_json: JSON.stringify({ Movement: 10, HP: 200, Attack: 1000 })
        });
        admin.assert(item && item.id, "Overkill Kit item must be created");
        overkillItemIds.push(item.id);
    }
});

for (let i = 0; i < rosterProfile.characters.length; i++) {
    const character = rosterProfile.characters[i];
    const purchase = upsilon.call("shop_purchase", { shop_item_id: overkillItemIds[i] });
    upsilon.assert(purchase && purchase.inventory_item, "Overkill Kit purchase must return an inventory item");
    upsilon.call("character_equip", { characterId: character.id, item_id: purchase.inventory_item.id });
}
upsilon.log(`[Bot-${agentIndex}] Equipped Overkill Kit on ${rosterProfile.characters.length} team member(s).`);

const matchData = upsilon.joinWaitMatch("1v1_PVE");
const matchId = matchData.match_id;

// 1. Walk the acting character toward the nearest living foe (Movement +10
// makes this a small, bounded number of the bot's own turns on any rolled
// board) and melee-attack as soon as adjacency is reached.
let attacked = false;
let damageDealt = 0;
let rounds = 0;
const MAX_ROUNDS = 60;

while (!attacked && rounds < MAX_ROUNDS) {
    rounds++;
    const board = upsilon.waitNextTurn();
    if (!board) break;

    const me = upsilon.currentCharacter();
    if (!me) continue;

    const foes = upsilon.myFoesCharacters().filter(f => f.hp > 0);
    if (foes.length === 0) break;

    // Nearest living foe.
    const foe = foes.reduce((closest, f) => {
        const d = Math.abs(me.position.x - f.position.x) + Math.abs(me.position.y - f.position.y);
        return (!closest || d < closest.dist) ? { entity: f, dist: d } : closest;
    }, null);

    if (foe.dist <= 1) {
        const prevHp = foe.entity.hp;
        const result = upsilon.call("game_action", {
            id: matchId,
            type: "attack",
            entity_id: me.id,
            target_coords: [foe.entity.position]
        });

        if (result && result.results && result.results.length > 0) {
            const targetResult = result.results.find(r => r.target_id === foe.entity.id);
            if (targetResult) {
                damageDealt = targetResult.damage;
                upsilon.log(`[Bot-${agentIndex}] Melee attacked ${foe.entity.name} for ${damageDealt} damage (${prevHp} -> ${targetResult.new_hp})`);
                attacked = true;
            }
        }
    } else {
        // planTravelToward truncates the returned path by the entity's
        // remaining movement credits, so this issues exactly one full-budget
        // move per turn instead of a single-tile step.
        const path = upsilon.planTravelToward(me.id, foe.entity.position, board);
        if (path && path.length > 0) {
            upsilon.call("game_action", {
                id: matchId,
                type: "move",
                entity_id: me.id,
                target_coords: path
            });
        } else {
            upsilon.call("game_action", { id: matchId, type: "pass", entity_id: me.id });
        }
    }
}

upsilon.log(`[Bot-${agentIndex}] Melee attack landed within ${rounds}/${MAX_ROUNDS} of the bot's own turns: ${attacked}`);
upsilon.assert(attacked, "Never landed a melee attack on an enemy within " + MAX_ROUNDS + " of the bot's own turns");
upsilon.assert(damageDealt > 500,
    `Melee attack damage (${damageDealt}) must exceed 500 to prove the attacker's Attack stat flowed through ` +
    "the computation — the formula floors damage at 1 (attack.go), so damage > 0 alone would be nearly vacuous");

upsilon.call("game_forfeit", { id: matchId });
upsilon.log(`[Bot-${agentIndex}] MELEE ATTACK DAMAGE PASSED.`);
