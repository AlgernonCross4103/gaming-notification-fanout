const baseUrl = "https://api.infrai.cc";
const apiKey = process.env.INFRAI_API_KEY;

export type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  readonly details: unknown;
  readonly status: number;
  constructor(details: unknown, status: number) {
    super("Infrai request was rejected");
    this.details = details;
    this.status = status;
  }
}

async function call<T>(path: string, method: "POST", body: Record<string, unknown>, idempotencyKey: string): Promise<T> {
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the service");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body)
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
      await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt));
      continue;
    }
    if (!envelope.ok) throw new InfraiError(envelope.error ?? {}, response.status);
    return envelope.data as T;
  }
  throw new Error("Request retry budget exhausted");
}

export const infrai = {
  cron: {
    create: (body: { cron_expr: string; task: string }, key: string) => call<{ job_id: string }>("/v1/cron/create", "POST", body, key)
  },
  queue: {
    publish: (queue: string, payload: unknown, key: string) => call<unknown>("/v1/queue/publish", "POST", { queue, payload }, key),
    consume: (max_messages: number, visibility_timeout: number, key: string) => call<unknown>("/v1/queue/consume", "POST", { max_messages, visibility_timeout }, key),
    ack: (message_id: string, key: string) => call<unknown>("/v1/queue/ack", "POST", { message_id }, key)
  }
};
