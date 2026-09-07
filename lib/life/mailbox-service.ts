export type MailboxPartnerKey = "cat" | "fish";
export type MailboxFormat = "letter" | "postcard";
export type MailboxStatus = "draft" | "sent";

export type MailboxLetter = {
  id: string;
  senderKey: MailboxPartnerKey;
  recipientKey: MailboxPartnerKey;
  format: MailboxFormat;
  title: string | null;
  themeKey: string;
  body: string;
  status: MailboxStatus;
  sentAt: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type MailboxWritePayload = {
  senderKey: MailboxPartnerKey;
  recipientKey: MailboxPartnerKey;
  format: MailboxFormat;
  title?: string | null;
  themeKey?: string;
  body: string;
  status?: MailboxStatus;
  sentAt?: string | null;
};

type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string };

export function parseMailboxPayload(value: unknown): ParseResult<MailboxWritePayload> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reason: "信件格式不正确" };
  }

  const v = value as Record<string, unknown>;
  const senderKey = v.senderKey;
  const recipientKey = v.recipientKey;
  const format = v.format ?? "letter";
  const status = v.status;
  const body = typeof v.body === "string" ? v.body.trim() : "";
  const title = typeof v.title === "string" ? v.title.trim().slice(0, 120) || null : null;
  const themeKey =
    typeof v.themeKey === "string" && v.themeKey.trim()
      ? v.themeKey.trim().slice(0, 40)
      : "cream";

  if (senderKey !== "cat" && senderKey !== "fish") {
    return { ok: false, reason: "寄件人不正确" };
  }
  if (recipientKey !== "cat" && recipientKey !== "fish") {
    return { ok: false, reason: "收件人不正确" };
  }
  if (senderKey === recipientKey) {
    return { ok: false, reason: "不能把信寄给自己" };
  }
  if (format !== "letter" && format !== "postcard") {
    return { ok: false, reason: "信件样式不正确" };
  }
  if (status !== undefined && status !== "draft" && status !== "sent") {
    return { ok: false, reason: "信件状态不正确" };
  }
  if (!body || body.length > 2000) {
    return { ok: false, reason: "信件内容不能为空且不能超过2000字" };
  }

  const sentAt = typeof v.sentAt === "string" && v.sentAt ? v.sentAt : null;
  if (sentAt && Number.isNaN(new Date(sentAt).getTime())) {
    return { ok: false, reason: "发送时间不正确" };
  }

  return {
    ok: true,
    value: {
      senderKey,
      recipientKey,
      format,
      title: format === "letter" ? title : null,
      themeKey,
      body,
      ...(status ? { status } : {}),
      sentAt,
    },
  };
}
