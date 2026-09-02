import {
  isRecordSource,
  type RecordSource,
} from "../ai/record-write-protocol";

export const LIFE_PARTNER_KEYS = ["fish", "cat"] as const;
export type LifePartnerKey = (typeof LIFE_PARTNER_KEYS)[number];

export const MOOD_KEYS = [
  "happy",
  "calm",
  "neutral",
  "anxious",
  "sad",
  "angry",
  "tired",
  "excited",
] as const;
export type MoodKey = (typeof MOOD_KEYS)[number];

export const ACTIVITY_PARTICIPANT_SCOPES = ["both", "fish", "cat"] as const;
export type ActivityParticipantScope =
  (typeof ACTIVITY_PARTICIPANT_SCOPES)[number];

export type MoodRecord = {
  id: string;
  partnerKey: LifePartnerKey;
  moodDate: string;
  moodKey: MoodKey;
  source: RecordSource;
  createdAt: string;
  updatedAt: string;
};

export type SleepRecord = {
  id: string;
  partnerKey: LifePartnerKey;
  sleepDate: string;
  fellAsleepAt: string;
  wokeAt: string;
  source: RecordSource;
  createdAt: string;
  updatedAt: string;
};

export type ActivityRecord = {
  id: string;
  activityDate: string;
  occurredAt: string | null;
  text: string;
  participantScope: ActivityParticipantScope;
  activityType: string | null;
  durationMinutes: number | null;
  source: RecordSource;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type LifeDayRecord = {
  date: string;
  moods: MoodRecord[];
  sleeps: SleepRecord[];
  activities: ActivityRecord[];
};

export type MoodWritePayload = {
  partnerKey: LifePartnerKey;
  moodDate: string;
  moodKey: MoodKey;
  source: RecordSource;
  idempotencyKey?: string;
};

export type SleepWritePayload = {
  partnerKey: LifePartnerKey;
  sleepDate: string;
  fellAsleepAt: string;
  wokeAt: string;
  source: RecordSource;
  idempotencyKey?: string;
};

export type ActivityWritePayload = {
  activityDate: string;
  occurredAt?: string | null;
  text: string;
  participantScope: ActivityParticipantScope;
  activityType?: string | null;
  durationMinutes?: number | null;
  source: RecordSource;
  idempotencyKey?: string;
};

type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function optionalText(value: unknown, maxLength: number) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.length <= maxLength ? normalized : undefined;
}

function optionalIdempotencyKey(value: unknown) {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 200 || normalized !== value) return null;
  return normalized;
}

export function parseLifeDayDate(value: unknown): ParseResult<string> {
  if (!isIsoDate(value)) {
    return { ok: false, reason: "日期必须是 YYYY-MM-DD" };
  }
  return { ok: true, value };
}

export function parseMoodWritePayload(value: unknown): ParseResult<MoodWritePayload> {
  if (!isRecord(value)) return { ok: false, reason: "心情记录格式不正确" };

  const partnerKey = value.partnerKey;
  const moodDate = value.moodDate;
  const moodKey = value.moodKey;
  const source = value.source ?? "manual";
  const idempotencyKey = optionalIdempotencyKey(value.idempotencyKey);

  if (!LIFE_PARTNER_KEYS.includes(partnerKey as LifePartnerKey)) {
    return { ok: false, reason: "记录人必须是 fish 或 cat" };
  }
  if (!isIsoDate(moodDate)) {
    return { ok: false, reason: "心情日期必须是 YYYY-MM-DD" };
  }
  if (!MOOD_KEYS.includes(moodKey as MoodKey)) {
    return { ok: false, reason: "心情选项不在允许范围内" };
  }
  if (!isRecordSource(source)) {
    return { ok: false, reason: "记录来源不正确" };
  }
  if (idempotencyKey === null) {
    return { ok: false, reason: "幂等键格式不正确" };
  }
  if (source === "manual" && idempotencyKey) {
    return { ok: false, reason: "手动记录不接受外部幂等键" };
  }

  return {
    ok: true,
    value: {
      partnerKey: partnerKey as LifePartnerKey,
      moodDate,
      moodKey: moodKey as MoodKey,
      source,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    },
  };
}

export function parseSleepWritePayload(value: unknown): ParseResult<SleepWritePayload> {
  if (!isRecord(value)) return { ok: false, reason: "睡眠记录格式不正确" };

  const partnerKey = value.partnerKey;
  const sleepDate = value.sleepDate;
  const source = value.source ?? "manual";
  const fellAsleepAt = normalizeTimestamp(value.fellAsleepAt);
  const wokeAt = normalizeTimestamp(value.wokeAt);
  const idempotencyKey = optionalIdempotencyKey(value.idempotencyKey);

  if (!LIFE_PARTNER_KEYS.includes(partnerKey as LifePartnerKey)) {
    return { ok: false, reason: "记录人必须是 fish 或 cat" };
  }
  if (!isIsoDate(sleepDate)) {
    return { ok: false, reason: "睡眠日期必须是 YYYY-MM-DD" };
  }
  if (!fellAsleepAt || !wokeAt) {
    return { ok: false, reason: "入睡和起床时间必须是有效时间" };
  }
  if (new Date(wokeAt).getTime() <= new Date(fellAsleepAt).getTime()) {
    return { ok: false, reason: "起床时间必须晚于入睡时间" };
  }
  if (!isRecordSource(source)) {
    return { ok: false, reason: "记录来源不正确" };
  }
  if (idempotencyKey === null) {
    return { ok: false, reason: "幂等键格式不正确" };
  }
  if (source === "manual" && idempotencyKey) {
    return { ok: false, reason: "手动记录不接受外部幂等键" };
  }

  return {
    ok: true,
    value: {
      partnerKey: partnerKey as LifePartnerKey,
      sleepDate,
      fellAsleepAt,
      wokeAt,
      source,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    },
  };
}

export function parseActivityWritePayload(value: unknown): ParseResult<ActivityWritePayload> {
  if (!isRecord(value)) return { ok: false, reason: "活动记录格式不正确" };

  const activityDate = value.activityDate;
  const text = optionalText(value.text, 500);
  const participantScope = value.participantScope ?? "both";
  const activityType = optionalText(value.activityType, 80);
  const source = value.source ?? "manual";
  const idempotencyKey = optionalIdempotencyKey(value.idempotencyKey);
  const occurredAt =
    value.occurredAt == null || value.occurredAt === ""
      ? null
      : normalizeTimestamp(value.occurredAt);

  let durationMinutes: number | null = null;
  if (value.durationMinutes != null && value.durationMinutes !== "") {
    if (
      typeof value.durationMinutes !== "number" ||
      !Number.isInteger(value.durationMinutes) ||
      value.durationMinutes < 0 ||
      value.durationMinutes > 24 * 60
    ) {
      return { ok: false, reason: "活动时长必须是 0 到 1440 分钟的整数" };
    }
    durationMinutes = value.durationMinutes;
  }

  if (!isIsoDate(activityDate)) {
    return { ok: false, reason: "活动日期必须是 YYYY-MM-DD" };
  }
  if (text === undefined || text === null) {
    return { ok: false, reason: "活动内容不能为空且最多 500 字" };
  }
  if (
    !ACTIVITY_PARTICIPANT_SCOPES.includes(
      participantScope as ActivityParticipantScope,
    )
  ) {
    return { ok: false, reason: "活动参与范围不正确" };
  }
  if (activityType === undefined) {
    return { ok: false, reason: "活动类型最多 80 字" };
  }
  if (value.occurredAt != null && value.occurredAt !== "" && !occurredAt) {
    return { ok: false, reason: "活动时间格式不正确" };
  }
  if (!isRecordSource(source)) {
    return { ok: false, reason: "记录来源不正确" };
  }
  if (idempotencyKey === null) {
    return { ok: false, reason: "幂等键格式不正确" };
  }
  if (source === "manual" && idempotencyKey) {
    return { ok: false, reason: "手动记录不接受外部幂等键" };
  }

  return {
    ok: true,
    value: {
      activityDate,
      occurredAt,
      text,
      participantScope: participantScope as ActivityParticipantScope,
      activityType,
      durationMinutes,
      source,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    },
  };
}
