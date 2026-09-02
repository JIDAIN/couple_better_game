export type MailboxPartnerKey = "cat" | "fish";
export type MailboxFormat = "letter" | "postcard";
export type MailboxLetter = {
  id: string;
  senderKey: MailboxPartnerKey;
  recipientKey: MailboxPartnerKey;
  format: MailboxFormat;
  body: string;
  sentAt: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};
export type MailboxWritePayload = {
  senderKey: MailboxPartnerKey;
  recipientKey: MailboxPartnerKey;
  format: MailboxFormat;
  body: string;
  sentAt?: string | null;
};

type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string };
export function parseMailboxPayload(value: unknown): ParseResult<MailboxWritePayload> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, reason: "信件格式不正确" };
  const v = value as Record<string, unknown>;
  const senderKey = v.senderKey;
  const recipientKey = v.recipientKey;
  const format = v.format ?? "letter";
  const body = typeof v.body === "string" ? v.body.trim() : "";
  if (senderKey !== "cat" && senderKey !== "fish") return { ok: false, reason: "寄件人不正确" };
  if (recipientKey !== "cat" && recipientKey !== "fish") return { ok: false, reason: "收件人不正确" };
  if (senderKey === recipientKey) return { ok: false, reason: "不能把信寄给自己" };
  if (format !== "letter" && format !== "postcard") return { ok: false, reason: "信件样式不正确" };
  if (!body || body.length > 2000) return { ok: false, reason: "信件内容不能为空且不能超过2000字" };
  const sentAt = typeof v.sentAt === "string" && v.sentAt ? v.sentAt : null;
  if (sentAt && Number.isNaN(new Date(sentAt).getTime())) return { ok: false, reason: "发送时间不正确" };
  return { ok: true, value: { senderKey, recipientKey, format, body, sentAt } };
}
