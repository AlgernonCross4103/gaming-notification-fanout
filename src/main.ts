import { infrai } from "./infrai.js";
import { fanout, notificationSchema } from "./fanout.js";

const input = notificationSchema.parse({
  playerId: "player-42",
  assetId: "asset-77",
  event: "asset_published",
  moderationQueue: "moderation-priority",
  subscribers: [{ id: "player-9", optedIn: true }, { id: "player-12", optedIn: false }, { id: "player-31", optedIn: true }]
});

const decision = fanout(input);
console.log(JSON.stringify(decision, null, 2));

if (process.env.INFRAI_API_KEY) {
  const key = `fanout-${input.assetId}`;
  const published = await infrai.queue.publish(input.moderationQueue, decision, key);
  const schedule = await infrai.cron.create({ cron_expr: "*/5 * * * *", task: process.env.WORKER_URL ?? "https://example.com/game-worker" }, `cron-${input.assetId}`);
  console.log(JSON.stringify({ published, job_id: schedule.job_id }));
}
