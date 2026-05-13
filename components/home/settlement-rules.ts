import type { ExerciseTag, HeatLevel, HeatmapDay } from "./types";

export const GEM_CAP = 50;

export type PersonKey = "fish" | "cat";

export type SideLogInput = {
  weightKg: number | null;
  deficit: number;
  minutes: number;
};

export type PreviousDailyRecord = {
  day: number;
  fish: Pick<SideLogInput, "deficit" | "minutes">;
  cat: Pick<SideLogInput, "deficit" | "minutes">;
};

export type CoinRuleContext = {
  fish: SideLogInput;
  cat: SideLogInput;
  todayDay: number;
  todayGemTotal: number;
  currentWeekGemTotal: number;
  dailyRecords: PreviousDailyRecord[];
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

export function hasDeficit(input: SideLogInput) {
  return input.deficit > 0;
}

export function gemsFromDeficit(person: PersonKey, deficit: number): number {
  if (person === "fish") {
    if (deficit >= 500) return 4;
    if (deficit >= 300) return 2;
    if (deficit >= 200) return 1;
    return 0;
  }

  if (deficit >= 200) return 2;
  if (deficit >= 100) return 1;
  return 0;
}

export function gemsFromExercise(
  person: PersonKey,
  minutes: number,
  personHasDeficit: boolean,
): number {
  if (person === "fish") {
    return minutes >= 30 ? 1 : 0;
  }

  if (!personHasDeficit) return 0;
  if (minutes >= 60) return 2;
  if (minutes >= 30) return 1;
  return 0;
}

export function computeRecoveryBonus(
  person: PersonKey,
  todayInput: SideLogInput,
  yesterdayRecord?: PreviousDailyRecord | null,
): number {
  if (!hasDeficit(todayInput) || !yesterdayRecord) return 0;
  return yesterdayRecord[person].minutes >= 30 ? 1 : 0;
}

export function gemsForPerson(
  person: PersonKey,
  input: SideLogInput,
  yesterdayRecord?: PreviousDailyRecord | null,
): number {
  const personHasDeficit = hasDeficit(input);
  return (
    gemsFromDeficit(person, input.deficit) +
    gemsFromExercise(person, input.minutes, personHasDeficit) +
    computeRecoveryBonus(person, input, yesterdayRecord)
  );
}

export function heatLevelFromDeficit(deficit: number): HeatLevel {
  if (deficit <= 0) return "none";
  if (deficit < 280) return "ok";
  if (deficit < 520) return "good";
  return "perfect";
}

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

export function getMaySettlementDay(): number {
  const d = new Date();
  if (d.getFullYear() === 2026 && d.getMonth() === 4) return d.getDate();
  return 11;
}

export type CoupleBonusResult = {
  gems: number;
  reasons: string[];
};

export function computeCoupleBonus(
  fish: SideLogInput,
  cat: SideLogInput,
): CoupleBonusResult {
  if (fish.minutes < 30 || cat.minutes < 30) {
    return { gems: 0, reasons: [] };
  }

  return {
    gems: 2,
    reasons: ["一起运动：双方各 +1，共 +2"],
  };
}

export type CoinPreview = {
  delta: number;
  hint: string;
};

function bothHaveDeficit(record: PreviousDailyRecord) {
  return record.fish.deficit > 0 && record.cat.deficit > 0;
}

function bothExercised(record: PreviousDailyRecord) {
  return record.fish.minutes >= 30 && record.cat.minutes >= 30;
}

function recordsInCurrentWeek(
  records: PreviousDailyRecord[],
  todayDay: number,
) {
  const weekStartDay = todayDay - ((todayDay - 1) % 7);
  return records.filter(
    (record) => record.day >= weekStartDay && record.day < todayDay,
  );
}

function countDeficitStreakBeforeToday(
  records: PreviousDailyRecord[],
  todayDay: number,
) {
  let streak = 0;
  for (let day = todayDay - 1; day >= 1; day -= 1) {
    const record = records.find((item) => item.day === day);
    if (!record || !bothHaveDeficit(record)) break;
    streak += 1;
  }
  return streak;
}

export function computeCoinPreview({
  fish,
  cat,
  todayDay,
  todayGemTotal,
  currentWeekGemTotal,
  dailyRecords,
}: CoinRuleContext): CoinPreview {
  let delta = 0;
  const bits: string[] = [];
  const nextWeekGemTotal = currentWeekGemTotal + todayGemTotal;

  if (currentWeekGemTotal < 30 && nextWeekGemTotal >= 30) {
    delta += 1;
    bits.push("本周新增宝石达到 30：+1");
  }

  if (currentWeekGemTotal < 50 && nextWeekGemTotal >= 50) {
    delta += 1;
    bits.push("本周新增宝石达到 50：再 +1");
  }

  const todayBothHaveDeficit = fish.deficit > 0 && cat.deficit > 0;
  const deficitStreak = todayBothHaveDeficit
    ? countDeficitStreakBeforeToday(dailyRecords, todayDay) + 1
    : 0;
  if (deficitStreak === 5) {
    delta += 1;
    bits.push("双人连续 5 天热量缺口打卡：+1");
  }

  const weekRecords = recordsInCurrentWeek(dailyRecords, todayDay);
  const previousTogetherExerciseCount = weekRecords.filter(bothExercised).length;
  const todayTogetherExercise = fish.minutes >= 30 && cat.minutes >= 30;
  const nextTogetherExerciseCount =
    previousTogetherExerciseCount + (todayTogetherExercise ? 1 : 0);
  if (previousTogetherExerciseCount < 2 && nextTogetherExerciseCount >= 2) {
    delta += 1;
    bits.push("本周一起运动达到 2 次：+1");
  }

  if (delta === 0) {
    return { delta: 0, hint: "本日暂未触发金币规则" };
  }

  return { delta, hint: bits.join(" · ") };
}
