// upsiloncli/tests/scenarios/edge_attack_skill_cooldown.js
// @test-link [[mech_skill_validation]]
//
// Validates the "Economic Cost — Cooldown Check" (skill.cooldown) in
// mech_skill_validation, isolated from the earlier "Action State
// Verification" gate (entity.alreadyacted), which would otherwise fire
// first for any reuse attempted within the same turn. The probe therefore
// spans two of the caster's own turns: cast once (succeeds, skill goes on
// cooldown) -> cast the same skill again on the caster's next turn (must be
// rejected with exactly skill.cooldown).
//
// An admin-created skill (EnemyOnly, whole-board range) is used instead of
// a randomly-rolled one: character_skill_roll can hand back a Self/Friend-
// targeted or passive skill (passives skip the cost/cooldown check
// entirely), which would make the edge unreachable or nondeterministic.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "cooldown_bot_" + botId;
const password = "VerySecurePassword123!";
const gameMode = "1v1_PVE";

upsilon.log(`[Bot-${agentIndex}] Starting EC-18: Attack Skill Cooldown`);

// 1. Admin setup: deterministic active EnemyOnly skill, range covers the
//    whole 1v1_PVE board (max width/height ~8) so opponent movement between
//    our turns can never cause an unrelated skill.target.range rejection.
let boltItemId;
upsilon.adminSection((admin) => {
    const tmpl = admin.call("admin_skill_template_create", {
        name: "CooldownBolt",
        behavior: "Direct",
        grade: "I",
        targeting: { TargetType: "EnemyOnly", Range: { value: 0, max: 20 } },
        costs: { MPLeech: 1 },
        effect: { DamageScale: 100 },
        weight_positive: 10,
        weight_negative: 0,
        available: true
    });
    admin.assert(tmpl && tmpl.id, "CooldownBolt template must be created");

    // Defense is padded heavily so the caster reliably survives to its own
    // next turn regardless of PVE roster strength — the point being probed
    // here is the cooldown gate, not whether the caster can tank a hit.
    const item = admin.call("admin_shop_item_create", {
        name: "Wand of CooldownBolt",
        slot: "utility",
        cost: 0,
        available: true,
        skill_template_id: tmpl.id,
        properties_json: JSON.stringify({ Defense: 500 })
    });
    admin.assert(item && item.id, "Wand item must be created");
    boltItemId = item.id;
});

// 2. Bot setup: buy + equip the deterministic skill on one character. (A
// single shop item row can only be equipped on one character at a time —
// equipping the same row onto a second character moves it rather than
// duplicating it — so exactly one designated caster carries it.)
upsilon.bootstrapBot(accountName, password);
const profile = upsilon.call("profile_get", {});
const casterId = profile.characters[0].id;

upsilon.call("shop_purchase", { shop_item_id: boltItemId });
const inventory = upsilon.call("profile_inventory", {});
const boltInv = inventory.find(i => i.shop_item && i.shop_item.name === "Wand of CooldownBolt");
upsilon.assert(boltInv && boltInv.id, "Wand must be in inventory after purchase");
upsilon.call("character_equip", { characterId: casterId, item_id: boltInv.id });

// 3. Battle: cast on the caster's first turn, then cast the same skill again
// on the caster's next turn.
//
// The caster can die before its next turn comes back around if the PVE
// opponent is unusually strong — that's roster/board-gen luck, not the
// mechanic under test — so this retries across a bounded number of matches,
// mirroring the same pattern used by e2e_friendly_fire_skill_test.js.
const MAX_MATCHES = 5;

let firstCastDone = false;
let secondCastErrorKey = null;

for (let attempt = 1; attempt <= MAX_MATCHES && secondCastErrorKey === null; attempt++) {
    if (attempt > 1) {
        upsilon.log(`[Bot-${agentIndex}] Retrying (attempt ${attempt}/${MAX_MATCHES})...`);
        try { upsilon.call("matchmaking_leave", {}); } catch (e) {}
    }

    let matchData;
    try {
        matchData = upsilon.joinWaitMatch(gameMode);
    } catch (e) {
        continue;
    }

    firstCastDone = false;
    // "await_cast" -> "await_pass" -> "await_cooldown_cast". Using a skill
    // sets both HasActed and HasMoved but does NOT end the turn by itself
    // (the engine only advances on an explicit end-of-turn/pass); a fresh
    // waitNextTurn() is taken between every action (one action per loop
    // iteration) so the harness's board cache never straddles two actions —
    // bundling the cast and the pass in one iteration raced the engine's
    // turn-advance and produced spurious entity.turn.mismatch.
    let stage = "await_cast";
    let rounds = 0;

    while (rounds < 60 && secondCastErrorKey === null) {
        rounds++;
        const board = upsilon.waitNextTurn();
        if (!board || board.game_finished) break; // team wiped or match over: try again

        const me = upsilon.currentCharacter();
        if (!me || !me.is_self) continue; // enemy's turn

        if (me.id !== casterId) {
            // A different character of ours: fight normally (move/attack via
            // the canonical helper) so the team survives long enough for the
            // caster's own turn to come back around.
            upsilon.autoBattleTurn(matchData.match_id);
            continue;
        }

        if (stage === "await_pass") {
            upsilon.call("game_action", { id: matchData.match_id, type: "pass", entity_id: casterId });
            stage = "await_cooldown_cast";
            // Give the turn-advance broadcast a moment to land before the next
            // waitNextTurn() re-checks the cached board (avoids racing the
            // engine's async turn.started event with a stale "still my turn"
            // read — the same class of race the sibling attack-already-acted
            // scenario hit and fixed by never bundling two actions per turn).
            upsilon.sleep(300);
            continue;
        }

        const foes = upsilon.myFoesCharacters().filter(f => f.hp > 0);
        if (foes.length === 0) break; // no target left: try again
        const foe = foes[0];

        const mySkill = (me.equipped_skills || []).find(s => s.name === "CooldownBolt");
        upsilon.assert(mySkill && mySkill.skill_id, "Caster must carry CooldownBolt on its turn");

        if (stage === "await_cast") {
            upsilon.call("game_action", {
                id: matchData.match_id,
                type: "skill",
                entity_id: casterId,
                skill_id: mySkill.skill_id,
                target_coords: [foe.position]
            });
            firstCastDone = true;
            upsilon.log(`[Bot-${agentIndex}] First cast succeeded; CooldownBolt should now be on cooldown.`);
            stage = "await_pass";
        } else {
            try {
                upsilon.call("game_action", {
                    id: matchData.match_id,
                    type: "skill",
                    entity_id: casterId,
                    skill_id: mySkill.skill_id,
                    target_coords: [foe.position]
                });
                upsilon.assert(false, "ERROR: Skill use while on cooldown was accepted!");
            } catch (e) {
                secondCastErrorKey = e.error_key;
            }
        }
    }
}

upsilon.assert(firstCastDone, "Test never reached the caster's first turn within " + MAX_MATCHES + " matches");
upsilon.assertEquals(secondCastErrorKey, "skill.cooldown", "Expected skill.cooldown on reuse");
upsilon.log(`[Bot-${agentIndex}] EC-18: ATTACK SKILL COOLDOWN PASSED.`);
