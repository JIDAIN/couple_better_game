import type { LifePartnerKey } from "./life-service";

export type WeightRecord = {
  id: string;
  partnerKey: LifePartnerKey;
  measuredAt: string | null;
  measurementDate: string;
  weightKg: number;
  source: string;
  context: string | null;
  note: string | null;
  linkedDailyRecordSideId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WeightWritePayload = {
  partnerKey: LifePartnerKey;
  measurementDate: string;
  measuredAt: string | null;
  weightKg: number;
  note: string | null;
};

type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function optionalText(value: unknown, max: number) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return null;
  return text.length <= max ? text : undefined;
}

export function parseWeightPartner(value: unknown): ParseResult<LifePartnerKey> {
  if (value !== "fish" && value !== "cat") return { ok: false, reason: "person 只能是 fish 或 cat" };
  return { ok: true, value };
}

export function parseWeightWritePayload(value: unknown): ParseResult<WeightWritePayload> {
  if (!isRecord(value)) return { ok: false, reason: "体重记录格式不正确" };
  const partner = parseWeightPartner(value.partnerKey);
  if (!partner.ok) return partner;
  if (!isIsoDate(value.measurementDate)) return { ok: false, reason: "measurementDate 必须是 YYYY-MM-DD" };
  if (typeof value.weightKg !== "number" || !Number.isFinite(value.weightKg) || value.weightKg <= 0 || value.weightKg >= 500) {
    return { ok: false, reason: "体重必须大于 0 且小于 500 kg" };
  }
  let measuredAt: string | null = null;
  if (value.measuredAt != null && value.measuredAt !== "") {
    if (typeof value.measuredAt !== "string" || Number.isNaN(Date.parse(value.measuredAt))) {
      return { ok: false, reason: "measuredAt 必须是有效时间" };
    }
    measuredAt = new Date(value.measuredAt).toISOString();
  }
  const note = optionalText(value.note, 1000);
  if (note === undefined) return { ok: false, reason: "备注不能超过 1000 个字符" };
  return {
    ok: true,
    value: {
      partnerKey: partner.value,
      measurementDate: value.measurementDate,
      measuredAt,
      weightKg: Math.round(value.weightKg * 100) / 100,
      note,
    },
  };
}
