export type LifeReminderStatus = "pending" | "snoozed" | "completed" | "dismissed";
export type LifeReminderSourceKind = "custom" | "medicine" | "anniversary" | "system";

export type LifeReminderItem = {
  id: string;
  ruleId: string | null;
  recipient: "cat" | "fish";
  sourceKind: LifeReminderSourceKind;
  title: string;
  content: string | null;
  dueAt: string;
  status: LifeReminderStatus;
  snoozedUntil: string | null;
  notifiedAt: string | null;
  completedAt: string | null;
  metadata: Record<string, unknown>;
};

export type LifeReminderSettings = {
  actor: "cat" | "fish";
  timezone: string;
  medicineReminderEnabled: boolean;
  medicineOffsets: number[];
  anniversaryReminderEnabled: boolean;
  anniversaryOffsets: number[];
  pushPlusConfigured: boolean;
};

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok) throw new Error(body?.error || "提醒服务暂时不可用");
  if (!body) throw new Error("提醒服务返回为空");
  return body;
}

export async function fetchLifeReminders() {
  const response = await fetch("/api/life/reminders", { cache: "no-store" });
  const body = await readJson<{ ok: true; items: LifeReminderItem[] }>(response);
  return Array.isArray(body.items) ? body.items : [];
}

export async function createLifeReminder(input: {
  recipientScope: "cat" | "fish" | "both";
  title: string;
  content?: string;
  dueAt: string;
}) {
  const response = await fetch("/api/life/reminders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJson<{ ok: true; item: unknown }>(response);
}

export async function actOnLifeReminder(
  id: string,
  action: "complete" | "dismiss" | "snooze",
  snoozeUntil?: string | null,
) {
  const response = await fetch("/api/life/reminders", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action, snoozeUntil: snoozeUntil ?? null }),
  });
  return readJson<{ ok: true; item: unknown }>(response);
}

export async function fetchLifeReminderSettings() {
  const response = await fetch("/api/life/reminders/settings", { cache: "no-store" });
  const body = await readJson<{ ok: true; settings: LifeReminderSettings }>(response);
  return body.settings;
}

export async function saveLifeReminderSettings(input: {
  medicineReminderEnabled: boolean;
  medicineOffsets: number[];
}) {
  const response = await fetch("/api/life/reminders/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readJson<{ ok: true; settings: LifeReminderSettings }>(response);
  return body.settings;
}

export function effectiveReminderTime(item: LifeReminderItem) {
  return item.snoozedUntil || item.dueAt;
}
