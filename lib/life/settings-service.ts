export type LifePartnerTargetWeights = {
  cat: number | null;
  fish: number | null;
};

export type LifeSettings = {
  anniversaryDate: string | null;
  targetWeights: LifePartnerTargetWeights;
};

export type LifeSettingsPatch = {
  anniversaryDate?: string | null;
  targetWeightKg?: number | null;
};

type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string };

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function normalizeLifeSettings(value: unknown): LifeSettings {
  const row = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const rawTargets = row.targetWeights && typeof row.targetWeights === "object" && !Array.isArray(row.targetWeights)
    ? row.targetWeights as Record<string, unknown>
    : {};
  const numberOrNull = (input: unknown) => typeof input === "number" && Number.isFinite(input)
    ? input
    : typeof input === "string" && input.trim() && Number.isFinite(Number(input))
      ? Number(input)
      : null;
  const anniversary = typeof row.anniversaryDate === "string" && isIsoDate(row.anniversaryDate)
    ? row.anniversaryDate
    : null;
  return {
    anniversaryDate: anniversary,
    targetWeights: {
      cat: numberOrNull(rawTargets.cat),
      fish: numberOrNull(rawTargets.fish),
    },
  };
}

export function parseLifeSettingsPatch(value: unknown): ParseResult<LifeSettingsPatch> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reason: "设置格式不正确" };
  }
  const row = value as Record<string, unknown>;
  const patch: LifeSettingsPatch = {};

  if (Object.prototype.hasOwnProperty.call(row, "anniversaryDate")) {
    if (row.anniversaryDate == null || row.anniversaryDate === "") patch.anniversaryDate = null;
    else if (typeof row.anniversaryDate === "string" && isIsoDate(row.anniversaryDate)) patch.anniversaryDate = row.anniversaryDate;
    else return { ok: false, reason: "纪念日必须是有效日期" };
  }

  if (Object.prototype.hasOwnProperty.call(row, "targetWeightKg")) {
    if (row.targetWeightKg == null || row.targetWeightKg === "") patch.targetWeightKg = null;
    else if (typeof row.targetWeightKg === "number" && Number.isFinite(row.targetWeightKg) && row.targetWeightKg > 0 && row.targetWeightKg < 500) {
      patch.targetWeightKg = Math.round(row.targetWeightKg * 100) / 100;
    } else return { ok: false, reason: "目标体重必须大于 0 且小于 500 kg" };
  }

  if (!Object.keys(patch).length) return { ok: false, reason: "没有可更新的设置" };
  return { ok: true, value: patch };
}

export function daysTogether(anniversaryDate: string | null, nowDate: string) {
  if (!anniversaryDate || !isIsoDate(anniversaryDate) || !isIsoDate(nowDate)) return null;
  const [ay, am, ad] = anniversaryDate.split("-").map(Number);
  const [ny, nm, nd] = nowDate.split("-").map(Number);
  const start = Date.UTC(ay, am - 1, ad);
  const current = Date.UTC(ny, nm - 1, nd);
  if (current < start) return null;
  return Math.floor((current - start) / 86_400_000) + 1;
}
