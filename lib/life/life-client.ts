import type { LifeMonthMoodRecord } from "./calendar-service";
import type { LifeMonthBundle } from "./month-bundle";
import type {
  ActivityRecord,
  ActivityWritePayload,
  LifeDayRecord,
  MoodRecord,
  MoodWritePayload,
  SleepRecord,
  SleepWritePayload,
} from "./life-service";

export class LifeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errorCode?: string,
  ) {
    super(message);
  }
}

type ApiErrorBody = {
  ok?: boolean;
  error?: string;
  errorCode?: string;
};

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new LifeApiError(
      body?.error ?? "生活记录请求失败",
      response.status,
      body?.errorCode,
    );
  }

  return (await response.json()) as T;
}

function manualPayload<T extends object>(payload: T) {
  return { ...payload, source: "manual" as const, idempotencyKey: undefined };
}

export async function fetchLifeDay(date: string) {
  const result = await fetchJson<{ ok: true; day: LifeDayRecord }>(
    `/api/life/day?date=${encodeURIComponent(date)}`,
  );
  return result.day;
}

export async function fetchLifeMonth(month: string) {
  const result = await fetchJson<{ ok: true; month: LifeMonthMoodRecord }>(
    `/api/life/month?month=${encodeURIComponent(month)}`,
  );
  return result.month;
}

export async function fetchLifeMonthBundle(month: string) {
  const result = await fetchJson<{ ok: true; bundle: LifeMonthBundle }>(
    `/api/life/month-bundle?month=${encodeURIComponent(month)}`,
  );
  return result.bundle;
}

export async function saveMood(
  payload: Omit<MoodWritePayload, "source" | "idempotencyKey">,
) {
  const result = await fetchJson<{ ok: true; mood: MoodRecord }>("/api/life/mood", {
    method: "PUT",
    body: JSON.stringify(manualPayload(payload)),
  });
  return result.mood;
}

export async function saveSleep(
  payload: Omit<SleepWritePayload, "source" | "idempotencyKey">,
) {
  const result = await fetchJson<{ ok: true; sleep: SleepRecord }>("/api/life/sleep", {
    method: "PUT",
    body: JSON.stringify(manualPayload(payload)),
  });
  return result.sleep;
}

export async function createActivityEntry(
  payload: Omit<ActivityWritePayload, "source" | "idempotencyKey">,
) {
  const result = await fetchJson<{ ok: true; activity: ActivityRecord }>(
    "/api/life/activities",
    {
      method: "POST",
      body: JSON.stringify(manualPayload(payload)),
    },
  );
  return result.activity;
}

export async function updateActivityEntry(
  activityId: string,
  payload: Omit<ActivityWritePayload, "source" | "idempotencyKey">,
) {
  const result = await fetchJson<{ ok: true; activity: ActivityRecord }>(
    `/api/life/activities/${encodeURIComponent(activityId)}`,
    {
      method: "PUT",
      body: JSON.stringify(manualPayload(payload)),
    },
  );
  return result.activity;
}

export async function deleteActivityEntry(activityId: string) {
  const result = await fetchJson<{ ok: true; activity: ActivityRecord }>(
    `/api/life/activities/${encodeURIComponent(activityId)}`,
    { method: "DELETE" },
  );
  return result.activity;
}