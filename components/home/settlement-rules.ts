import type { ExerciseTag, HeatLevel, HeatmapDay } from "./types";

/** 单侧当日输入（用于预览与结算） */
export type SideLogInput = {
  /** 有填体重则为数字，未填为 null */
  weightKg: number | null;
  /** 热量缺口 kcal，允许 0 */
  deficit: number;
  /** 运动时长（分钟） */
  minutes: number;
};

export function parseOptionalWeight(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseNonNegativeInt(raw: string, fallback = 0): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

/** 热力图：缺口完成度 */
export function heatLevelFromDeficit(deficit: number): HeatLevel {
  if (deficit <= 0) return "none";
  if (deficit < 280) return "ok";
  if (deficit < 520) return "good";
  return "perfect";
}

/** 热力图：运动角标 */
export function exerciseTagFromMinutes(minutes: number): ExerciseTag {
  if (minutes <= 0) return "none";
  if (minutes < 40) return "run";
  return "intense";
}

export function buildHeatmapDay(input: SideLogInput): HeatmapDay {
  return {
    level: heatLevelFromDeficit(input.deficit),
    exercise: exerciseTagFromMinutes(input.minutes),
  };
}

/**
 * 单人宝石：缺口档 + 运动档 + 可选体重打卡
 * （轻量游戏规则，便于以后替换为真实算法）
 */
export function gemsForPerson(input: SideLogInput): number {
  let g = 0;
  if (input.deficit > 0) {
    if (input.deficit < 220) g += 1;
    else if (input.deficit < 420) g += 2;
    else g += 3;
  }
  if (input.minutes >= 1) g += input.minutes < 28 ? 1 : 2;
  if (input.weightKg != null) g += 1;
  return g;
}

/** 五月结算日：真实日历在 2026/5 时用当天；否则用 11 号 demo */
export function getMaySettlementDay(): number {
  const d = new Date();
  if (d.getFullYear() === 2026 && d.getMonth() === 4) return d.getDate();
  return 11;
}

export type CoupleBonusResult = {
  gems: number;
  /** 展示用标签 */
  reasons: string[];
};

/** 满足「一起动」或「双人缺口达标」其一即给一次情侣加成 */
export function computeCoupleBonus(
  fish: SideLogInput,
  cat: SideLogInput,
): CoupleBonusResult {
  const moveTogether = fish.minutes >= 20 && cat.minutes >= 20;
  const deficitTogether = fish.deficit >= 300 && cat.deficit >= 300;
  if (!moveTogether && !deficitTogether) {
    return { gems: 0, reasons: [] };
  }
  const reasons: string[] = [];
  if (moveTogether) reasons.push("一起运动");
  if (deficitTogether) reasons.push("双人达标");
  return { gems: 2, reasons };
}

export type CoinPreview = {
  delta: number;
  /** 简短提示文案 */
  hint: string;
};

export function computeCoinPreview(
  fish: SideLogInput,
  cat: SideLogInput,
  coupleBonusActive: boolean,
): CoinPreview {
  let delta = 0;
  const bits: string[] = [];
  if (coupleBonusActive) {
    delta += 1;
    bits.push("同频小彩头 +1");
  }
  const doubleSpark =
    fish.deficit >= 520 &&
    cat.deficit >= 520 &&
    fish.minutes >= 32 &&
    cat.minutes >= 32;
  if (doubleSpark) {
    delta += 1;
    bits.push("双星闪耀 +1");
  }
  if (delta === 0) {
    return { delta: 0, hint: "本日暂无额外金币触发" };
  }
  return { delta, hint: bits.join(" · ") };
}
