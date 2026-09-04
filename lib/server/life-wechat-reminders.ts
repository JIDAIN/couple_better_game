const DEFAULT_SUPABASE_URL = "https://bfhntnzngozdqsmgfvjk.supabase.co";
const DEFAULT_SPACE_SLUG = "couple-better-game";

export type LifeReminderActor = "cat" | "fish";
export type LifeReminderKind = "daily_record" | "anniversary";

export type ClaimedLifeReminder = {
  deliveryId: string;
  kind: LifeReminderKind;
  localDate: string;
  targetDate: string | null;
  daysUntil: number | null;
};

export type WechatReminderMessage = {
  title: string;
  content: string;
};

export type LifePushplusStatus = {
  actor: LifeReminderActor;
  configured: boolean;
};

export type LifePushplusTestResult = {
  actor: LifeReminderActor;
  ok: boolean;
  providerMessageId: string | null;
  error: string | null;
};

type RpcErrorBody = { message?: string };
type JsonRecord = Record<string, unknown>;

export class LifeWechatReminderError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function supabaseUrl() {
  return env("SUPABASE_URL") || DEFAULT_SUPABASE_URL;
}

function supabaseSecretKey() {
  return env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
}

function coupleSpaceSlug() {
  return env("COUPLE_SPACE_SLUG") || DEFAULT_SPACE_SLUG;
}

async function callRpc<T>(functionName: string, body: Record<string, unknown>) {
  const secret = supabaseSecretKey();
  if (!secret) throw new LifeWechatReminderError("Supabase 服务端环境变量未配置完整");

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl()}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new LifeWechatReminderError("连接 Supabase 失败");
  }

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as RpcErrorBody | null;
    throw new LifeWechatReminderError(error?.message ?? "微信提醒服务调用失败");
  }
  return (await response.json()) as T;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown) {
  const result = stringValue(value);
  return result || null;
}

function nullableInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function harborAiName(actor: LifeReminderActor) {
  return actor === "cat" ? "团子" : "仔仔";
}

export function parseLifePushplusStatus(value: unknown): LifePushplusStatus | null {
  const row = asRecord(value);
  const actor = row.actor;
  if (actor !== "cat" && actor !== "fish") return null;
  if (typeof row.configured !== "boolean") return null;
  return { actor, configured: row.configured };
}

export function parseLifePushplusTestResult(value: unknown): LifePushplusTestResult | null {
  const row = asRecord(value);
  const actor = row.actor;
  if (actor !== "cat" && actor !== "fish") return null;
  if (typeof row.ok !== "boolean") return null;
  return {
    actor,
    ok: row.ok,
    providerMessageId: nullableString(row.providerMessageId),
    error: nullableString(row.error),
  };
}

export async function getLifePushplusStatus(actor: LifeReminderActor) {
  const payload = await callRpc<unknown>("get_life_pushplus_status", { p_actor: actor });
  const status = parseLifePushplusStatus(payload);
  if (!status) throw new LifeWechatReminderError("微信提醒状态格式不正确");
  return status;
}

export async function setLifePushplusToken(actor: LifeReminderActor, token: string) {
  const normalized = token.trim();
  if (normalized.length < 10 || normalized.length > 256) {
    throw new LifeWechatReminderError("PushPlus token 格式不正确");
  }
  const payload = await callRpc<unknown>("set_life_pushplus_token", {
    p_actor: actor,
    p_token: normalized,
  });
  const status = parseLifePushplusStatus(payload);
  if (!status) throw new LifeWechatReminderError("微信提醒保存结果格式不正确");
  return status;
}

export async function clearLifePushplusToken(actor: LifeReminderActor) {
  const payload = await callRpc<unknown>("clear_life_pushplus_token", { p_actor: actor });
  const status = parseLifePushplusStatus(payload);
  if (!status) throw new LifeWechatReminderError("微信提醒清除结果格式不正确");
  return status;
}

export async function testLifePushplus(actor: LifeReminderActor) {
  const payload = await callRpc<unknown>("test_life_pushplus", { p_actor: actor });
  const result = parseLifePushplusTestResult(payload);
  if (!result) throw new LifeWechatReminderError("微信提醒测试结果格式不正确");
  return result;
}

export function parseClaimedLifeReminder(value: unknown): ClaimedLifeReminder | null {
  const row = asRecord(value);
  const deliveryId = stringValue(row.deliveryId);
  const kind = row.kind;
  const localDate = stringValue(row.localDate);
  if (!isUuid(deliveryId)) return null;
  if (kind !== "daily_record" && kind !== "anniversary") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return null;

  return {
    deliveryId,
    kind,
    localDate,
    targetDate: nullableString(row.targetDate),
    daysUntil: nullableInteger(row.daysUntil),
  };
}

export function buildWechatReminderMessage(
  actor: LifeReminderActor,
  reminder: ClaimedLifeReminder,
): WechatReminderMessage {
  const aiName = harborAiName(actor);

  if (reminder.kind === "daily_record") {
    return {
      title: `${aiName}提醒｜今天还没记录`,
      content: `今天还没有看到你的生活记录。记一点就好，不用补全，也不用和 Ta 比较。——${aiName}`,
    };
  }

  if (reminder.daysUntil === 0) {
    return {
      title: `${aiName}提醒｜今天是你们的纪念日`,
      content: `今天是你们的纪念日 💛 不需要完成什么任务，给彼此留一点开心的时间就很好。——${aiName}`,
    };
  }
  if (reminder.daysUntil === 1) {
    return {
      title: `${aiName}提醒｜明天是你们的纪念日`,
      content: `明天就是你们的纪念日啦 💛 想庆祝的话，可以提前留一点时间给彼此。——${aiName}`,
    };
  }

  const days = reminder.daysUntil ?? 0;
  return {
    title: `${aiName}提醒｜纪念日还有 ${days} 天`,
    content: `还有 ${days} 天就是你们的纪念日啦 💛 想庆祝的话，可以提前想想怎么一起过。——${aiName}`,
  };
}

export async function claimLifeWechatReminders(
  actor: LifeReminderActor,
  now: Date = new Date(),
) {
  const payload = await callRpc<unknown>("claim_life_notification_reminders", {
    p_actor: actor,
    p_now: now.toISOString(),
    p_space_slug: coupleSpaceSlug(),
  });
  const root = asRecord(payload);
  const rows = Array.isArray(root.reminders) ? root.reminders : [];
  const reminders = rows
    .map(parseClaimedLifeReminder)
    .filter((item): item is ClaimedLifeReminder => item !== null)
    .map((item) => ({ ...item, message: buildWechatReminderMessage(actor, item) }));

  return { actor, reminders };
}

export async function completeLifeWechatReminder(
  actor: LifeReminderActor,
  input: {
    deliveryId: string;
    accepted: boolean;
    providerMessageId?: string | null;
    error?: string | null;
  },
) {
  if (!isUuid(input.deliveryId)) throw new LifeWechatReminderError("提醒 deliveryId 无效");
  return callRpc<Record<string, unknown>>("complete_life_notification_delivery", {
    p_delivery_id: input.deliveryId,
    p_actor: actor,
    p_accepted: input.accepted,
    p_provider_message_id: input.providerMessageId?.trim() || null,
    p_provider_error: input.error?.trim().slice(0, 1000) || null,
    p_space_slug: coupleSpaceSlug(),
  });
}
