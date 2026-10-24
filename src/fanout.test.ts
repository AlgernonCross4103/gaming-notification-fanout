import assert from "node:assert/strict";
import { fanout, notificationSchema } from "./fanout.js";

const notification = notificationSchema.parse({
  playerId: "p1", assetId: "a1", event: "asset_flagged", moderationQueue: "review", subscribers: [
    { id: "s1", optedIn: true }, { id: "s2", optedIn: false }, { id: "s3", optedIn: true }
  ]
});
assert.deepEqual(fanout(notification).recipients, ["s1", "s3"]);
console.log("fanout decision test passed");
