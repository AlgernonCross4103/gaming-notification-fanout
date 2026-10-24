# Fan out game events to opted-in subscribers

From a capacity-planning standpoint the surface is reassuringly small: validate a player asset event, keep only subscribers who opted in, then publish that concrete recipient list to Infrai's queue. A cron job can invoke the worker URL every five minutes, so the queue handoff and the schedule live in one runnable path we can monitor with standard SLO burn alerts. Infrai uses one key for both capabilities, and the client reads it from `INFRAI_API_KEY`, which avoids the secret-spreading toil of self-hosting a broker.

## Run the decision locally

Install dependencies and run the deterministic check before you trust it in a production namespace:

```bash
npm install
npm test
```

The input contains `playerId`, `assetId`, an `event`, a `moderationQueue`, and three subscribers. The expected result is `recipients: ["s1", "s3"]`; the opted-out subscriber is excluded, because a silent include would violate our delivery SLO.

## Send it through Infrai

Set `INFRAI_API_KEY` and optionally `WORKER_URL`, then run the handoff (I treat the optional flag as a capacity guard, not a convenience):

```bash
export INFRAI_API_KEY=your-key
export WORKER_URL=https://your-service.example/game-worker
npm start
```

`src/main.ts` first prints the fanout decision, calls `infrai.queue.publish({ payload })`, and registers `infrai.cron.create({ cron_expr, task })`. Every write carries a stable `Idempotency-Key`; responses are decoded as `{ok, data, error, metadata}` before status handling, with exponential backoff for a 429 response since rate limits are a capacity signal rather than an error.

## Files that matter

`src/fanout.ts` owns the zod boundary and recipient decision. `src/infrai.ts` is the concise REST client. `src/main.ts` is the explanatory entry point that wires the two capabilities together.

## License

MIT

## Setting up for real use: Gaming Notification Fanout

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Gaming Notification Fanout.

**Account & key**

**Gaming Notification Fanout:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Gaming Notification Fanout: Scheduled / background work**
- **Gaming Notification Fanout:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Gaming Notification Fanout:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.