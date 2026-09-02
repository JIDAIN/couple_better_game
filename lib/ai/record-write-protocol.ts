export const RECORD_SOURCES = ["manual", "chatgpt", "import"] as const;
export type RecordSource = (typeof RECORD_SOURCES)[number];

export const AI_WRITABLE_DOMAINS = [
  "meal",
  "mood",
  "sleep",
  "activity",
  "weight",
  "medicine",
] as const;
export type AiWritableDomain = (typeof AI_WRITABLE_DOMAINS)[number];

export const CHATGPT_WRITE_PREFIX = "chatgpt:";

function safeSegment(value: string, maxLength: number) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
}

export function isRecordSource(value: unknown): value is RecordSource {
  return typeof value === "string" && RECORD_SOURCES.includes(value as RecordSource);
}

export function isAiWritableDomain(value: unknown): value is AiWritableDomain {
  return typeof value === "string" && AI_WRITABLE_DOMAINS.includes(value as AiWritableDomain);
}

/**
 * Stable idempotency key format for future ChatGPT writes across all domains.
 *
 * The conversation/tool layer still owns the semantic confirmation step. This
 * helper only creates a deterministic retry key after a user has explicitly
 * asked to persist a change.
 */
export function buildChatgptWriteIdempotencyKey({
  domain,
  scope,
  recordDate,
  confirmationNonce,
}: {
  domain: AiWritableDomain;
  scope: string;
  recordDate: string;
  confirmationNonce: string;
}) {
  const safeScope = safeSegment(scope, 40);
  const safeDate = safeSegment(recordDate, 20);
  const safeNonce = safeSegment(confirmationNonce, 80);

  if (!safeScope || !safeDate || !safeNonce) {
    throw new Error("ChatGPT write idempotency key 参数不能为空");
  }

  const key = `${CHATGPT_WRITE_PREFIX}${domain}:${safeScope}:${safeDate}:${safeNonce}`;
  if (key.length > 200) {
    throw new Error("ChatGPT write idempotency key 过长");
  }
  return key;
}

export function isChatgptWriteIdempotencyKey(
  value: unknown,
  domain?: AiWritableDomain,
) {
  if (typeof value !== "string" || value.length > 200 || value.trim() !== value) {
    return false;
  }
  const prefix = domain
    ? `${CHATGPT_WRITE_PREFIX}${domain}:`
    : CHATGPT_WRITE_PREFIX;
  return value.startsWith(prefix);
}

/**
 * AI write architecture contract:
 *
 * conversation confirmation
 * -> domain-specific prepare/validation
 * -> domain-specific canonical write service/RPC
 * -> read-back
 *
 * There is intentionally no generic "AI can run arbitrary SQL" helper here.
 */
export type ConfirmedAiWrite<TPayload> = {
  domain: AiWritableDomain;
  source: "chatgpt";
  idempotencyKey: string;
  payload: TPayload;
};