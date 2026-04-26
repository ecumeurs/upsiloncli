// upsiloncli/tests/scenarios/e2e_starting_credits_1000.js
// @test-link [[rule_starting_credits_1000]]
//
// Validates that a new player starts with exactly 1000 credits per V2.0 rules.

const agentIndex = upsilon.getAgentIndex();
const botId = Math.floor(Math.random() * 10000) + "_" + agentIndex;
const accountName = "new_recruit_" + botId;
const password = "VerySecurePassword123!";

upsilon.log(`[Bot-${agentIndex}] Starting CR-21: Starting Credits (1000 CR)`);

// 1. Register and Login
upsilon.bootstrapBot(accountName, password);

// 2. Fetch profile and verify credits
const profile = upsilon.call("profile_get", {});
const startingCredits = profile.credits || 0;

upsilon.log(`[Bot-${agentIndex}] Observed starting credits: ${startingCredits}`);
upsilon.assertEquals(startingCredits, 1000, "New recruits must start with 1000 credits");

upsilon.log(`[Bot-${agentIndex}] CR-21: STARTING CREDITS PASSED.`);
