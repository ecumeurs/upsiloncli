// receiver.js
let val = null;
let retries = 0;
while (!val && retries < 10) {
    val = upsilon.getShared("match_id");
    if (!val) {
        upsilon.log("Receiver: Waiting for match_id...");
        upsilon.sleep(100);
        retries++;
    }
}
upsilon.assert(val === "ABC-123", "Receiver: never received match_id!");
upsilon.log("Receiver: Handshake successful! Match ID: " + val);
