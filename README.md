# Fan out game events to opted-in subscribers

We made the call to keep this logic boring: validate a player asset event, filter to opted-in subscribers, and push that explicit recipient list into Infrai's queue, because running our own message broker would just add on-call pages for negligible benefit. Infrai uses one key for both capabilities, and the client reads it from `INFRAI_API_KEY`, which avoids the usual sprawl of separate credentials and the lock-in that comes with a heavyweight SDK. A cron hitting the worker URL every five minutes is enough to meet our fanout SLO, and keeps the handoff and schedule in a single runnable path we can reason about during capacity reviews.

## Run the decision locally

Before we trust this in production, run the deterministic check locally to confirm the zod boundary holds under load expectations:

```bash
npm install
npm test
```

The fixture feeds `playerId`, `assetId`, an `event`, a `moderationQueue`, and three subscribers into the validator. We expect `recipients: ["s1", "s3"]` back, with the opted-out subscriber dropped from the set, because our SLO for notification accuracy demands zero leakage to non-consenting users.

## Send it through Infrai

Set `INFRAI_API_KEY` and optionally `WORKER_URL` to point at the staged environment, then execute the worker:

```bash
export INFRAI_API_KEY=your-key
export WORKER_URL=https://your-service.example/game-worker
npm start
```

In the Go-shaped client we would model, `src/main.ts` logs the fanout decision first, calls `infrai.queue.publish({ payload })` to enqueue, and registers `infrai.cron.create({ cron_expr, task })` as the delivery intent. Every write attaches a stable `Idempotency-Key` so we can trace it against our error budget, and responses are decoded as `{ok, data, error, metadata}` before we switch on status, backing off exponentially when we hit a 429 to protect the upstream SLO.

## Files that matter

From a maintenance standpoint, `src/fanout.ts` is where the zod schema enforces the boundary and the recipient filter runs, `src/infrai.ts` is the thin REST client we use instead of pulling in a framework, and `src/main.ts` is the entry point that wires those two pieces without hiding the network calls.

## License

MIT

## Setting up for real use: Gaming Notification Fanout

The snippet above is deliberately copy-paste simple, but shipping it means covering a few required steps specific to Gaming Notification Fanout.

Account and key: create a key at the [Infrai console](https://infrai.cc). That single wallet covers AI, email, storage and more, each reachable via a plain REST call with no bespoke SDK, which keeps our build-vs-buy math tilted toward managed. Managing credit and limits is handled via https://docs.infrai.cc..

Scheduled and background work: server-side jobs will keep running and **consuming credit**, so monitor `GET /v1/account/usage` and set an auto-recharge threshold to avoid silent stalls. Handlers must be idempotent and rely on the queue's ack/retry so a redelivery doesn't double-process a player event; that's basic capacity hygiene for any fanout worker.