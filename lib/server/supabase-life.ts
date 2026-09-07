import type { LifeMonthMoodRecord } from "../life/calendar-service";
import type { LifeMonthBundle } from "../life/month-bundle";
import { withMoodLabel } from "../life/mood-labels";
import type {
  ActivityRecord,
  ActivityWritePayload,
  LifeDayRecord,
  MoodRecord,
  MoodWritePayload,
  SleepRecord,
  SleepWritePayload,
} from "../life/life-service";

const DEFAULT_SUPABASE_URL = "https://bfhntnzngozdqsmgfvjk.supabase.co";
const DEFAULT_SPACE_SLUG = "couple-better-game";

type RpcErrorBody = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

export class LifeCloudError extends Error {
  constructor(
    message: string,
    public readonly errorCode:
      | "SERVER_CONFIG"
      | "LIFE_READ_FAILED"
      | "LIFE_WRITE_FAILED"
      | "CLOUD_NETWORK_ERROR",
  ) {
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

async function callRpc<T>(
  functionName: string,
  body: Record<string, unknown>,
  operation: "read" | "write",
): Promise<T> {
  const url = supabaseUrl();
  const secretKey = supabaseSecretKey();
  if (!url || !secretKey) {
    throw new LifeCloudError(
      "Supabase 服务端环境变量未配置完整",
      "SERVER_CONFIG",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new LifeCloudError("连接 Supabase 失败", "CLOUD_NETWORK_ERROR");
  }

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as RpcErrorBody | null;
    const fallback = operation === "read" ? "读取生活记录失败" : "写入生活记录失败";
    throw new LifeCloudError(
      result?.message ?? fallback,
      operation === "read" ? "LIFE_READ_FAILED" : "LIFE_WRITE_FAILED",
    );
  }

  return (await response.json()) as T;
}

export async function getLifeDay(recordDate: string) {
  const day = await callRpc<LifeDayRecord>(
    "get_life_day",
    { p_record_date: recordDate, p_space_slug: coupleSpaceSlug() },
    "read",
  );
  return {
    ...day,
    moods: day.moods.map(withMoodLabel),
  };
}

export async function getLifeMonthMoods(monthStart: string) {
  const month = await callRpc<LifeMonthMoodRecord>(
    "get_life_month_moods",
    { p_month_start: monthStart, p_space_slug: coupleSpaceSlug() },
    "read",
  );
  return {
    ...month,
    days: month.days.map((day) => ({
      ...day,
      moods: day.moods.map(withMoodLabel),
    })),
  };
}

export async function getLifeMonthBundle(monthStart: string) {
  return callRpc<LifeMonthBundle>(
    "get_life_month_bundle",
    { p_month_start: monthStart, p_space_slug: coupleSpaceSlug() },
    "read",
  );
}

export async function upsertMood(payload: MoodWritePayload) {
  const mood = await callRpc<MoodRecord>(
    "upsert_mood_record",
    { p_payload: payload, p_space_slug: coupleSpaceSlug() },
    "write",
  );
  return withMoodLabel(mood);
}

export async function deleteMood(moodId: string, partnerKey: "cat" | "fish") {
  const mood = await callRpc<MoodRecord>(
    "delete_mood_record",
    {
      p_mood_id: moodId,
      p_partner_key: partnerKey,
      p_space_slug: coupleSpaceSlug(),
    },
    "write",
  );
  return withMoodLabel(mood);
}

export async function upsertSleep(payload: SleepWritePayload) {
  return callRpc<SleepRecord>(
    "upsert_sleep_record",
    { p_payload: payload, p_space_slug: coupleSpaceSlug() },
    "write",
  );
}

export async function createActivity(payload: ActivityWritePayload) {
  return callRpc<ActivityRecord>(
    "create_activity_record",
    { p_payload: payload, p_space_slug: coupleSpaceSlug() },
    "write",
  );
}

export async function updateActivity(
  activityId: string,
  payload: ActivityWritePayload,
) {
  return callRpc<ActivityRecord>(
    "update_activity_record",
    {
      p_activity_id: activityId,
      p_payload: payload,
      p_space_slug: coupleSpaceSlug(),
    },
    "write",
  );
}

export async function deleteActivity(activityId: string) {
  return callRpc<ActivityRecord>(
    "delete_activity_record",
    { p_activity_id: activityId, p_space_slug: coupleSpaceSlug() },
    "write",
  );
}