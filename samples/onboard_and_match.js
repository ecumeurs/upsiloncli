// Upsilon Bot: Onboarding & Queueing
// Adheres to @rule_password_policy (15+ chars, uppercase, numeric, symbol)

const botId = Date.now();
const accountName = "bot_" + botId;
const password = "BotPassword123!456"; // 18 chars, has upper, digit, symbol

upsilon.log("Starting onboarding process for: " + accountName);

// 1. Register a new account
const regResponse = upsilon.call("auth_register", {
    account_name: accountName,
    email: accountName + "@example.com",
    nickname: "Bot_" + botId,
    password: password
});

if (regResponse && regResponse.token) {
    upsilon.log("Registration successful. JWT obtained.");
} else {
    upsilon.log("Registration failed or did not return a token.");
    throw new Error("Onboarding failed");
}

// 2. Join a 1v1 PVE Match
upsilon.log("Entering 1v1 PVE queue...");
const joinResponse = upsilon.call("matchmaking_join", {
    queue: "1v1_pve"
});

if (joinResponse) {
    upsilon.log("Queued successfully. Waiting for match...");
}

// 3. Wait for MatchFound event (Real-time synchronization)
try {
    const matchEnvelope = upsilon.waitForEvent("match.found", 60000); // Wait up to 60s
    upsilon.log("Match Found! ID: " + matchEnvelope.data.match_id);
} catch (e) {
    upsilon.log("Timed out waiting for match. Check Laravel Reverb connectivity.");
}

upsilon.log("Journey finished.");
