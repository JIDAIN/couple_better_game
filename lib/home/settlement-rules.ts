import type {
  CoinRulesConfig,
  ExerciseTag,
  HeatLevel,
  HeatmapDay,
  PersonKey,
  SettlementVisualRules,
  SideLogInput,
} from "./types";

export const GEM_CAP = 50;
export const COIN_CAP = GEM_CAP;

export type {
  CoinRulesConfig,
  PersonKey,
  SettlementVisualRules,
  SideLogInput,
} from "./types";

export type PreviousDailyRecord = {
  day: number;
  recordDate?: string;
  fish: Pick<SideLogInput, "deficit" | "minutes">;
  cat: Pick<SideLogInput, "deficit" | "minutes">;
};

export type CoinRuleContext = {
  fish: SideLogInput;
  cat: SideLogInput;
  todayDay: number;
  todayDate?: string;
  todayGemTotal: number;
  currentWeekGemTotal: number;
  dailyRecords: PreviousDailyRecord[];
  coinRules?: CoinRulesConfig;
  visualRules?: SettlementVisualRules;
};

export const COIN_WEEK_START_DAY = 6;

export const DEFAULT_COIN_RULES: CoinRulesConfig = {
  weekStartDay: COIN_WEEK_START_DAY,
  deficitStreakDays: 5,
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

export function parseInteger(raw: string, fallback = 0): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
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
  if (!personHasDeficit) return 0;

  if (person === "fish") {
    return minutes >= 30 ? 1 : 0;
  }

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

export type GemBreakdown = {
  deficit: number;
  exercise: number;
  recovery: number;
  total: number;
  lines: string[];
};

export function gemBreakdownForPerson(
  person: PersonKey,
  input: SideLogInput,
  yesterdayRecord?: PreviousDailyRecord | null,
): GemBreakdown {
  const personHasDeficit = hasDeficit(input);
  const deficit = gemsFromDeficit(person, input.deficit);
  const exercise = gemsFromExercise(person, input.minutes, personHasDeficit);
  const recovery = computeRecoveryBonus(person, input, yesterdayRecord);
  const lines = [
    `缺口金币 +${deficit}`,
    `运动金币 +${exercise}`,
    `恢复日奖励 +${recovery}`,
  ];

  return {
    deficit,
    exercise,
    recovery,
    total: deficit + exercise + recovery,
    lines,
  };
}

export const DEFAULT_VISUAL_RULES: SettlementVisualRules = {
  heatmap: {
    fish: {
      noneMax: 199,
      okMin: 200,
      goodMin: 300,
      perfectMin: 500,
    },
    cat: {
      noneMax: 99,
      okMin: 100,
      goodMin: 200,
      perfectMin: 300,
    },
  },
  exerciseTag: {
    runMin: 1,
    intenseMin: 60,
  },
};

export function heatLevelFromDeficit(
  person: PersonKey,
  deficit: number,
  rules: SettlementVisualRules = DEFAULT_VISUAL_RULES,
): HeatLevel {
  const thresholds = rules.heatmap[person];
  if (deficit < thresholds.okMin) return "none";
  if (deficit >= thresholds.perfectMin) return "perfect";
  if (deficit >= thresholds.goodMin) return "good";
  if (deficit >= thresholds.okMin) return "ok";
  return "none";
}

export function exerciseTagFromMinutes(
  minutes: number,
  rules: SettlementVisualRules = DEFAULT_VISUAL_RULES,
): ExerciseTag {
  const thresholds = rules.exerciseTag;
  if (minutes < thresholds.runMin) return "none";
  if (minutes >= thresholds.intenseMin) return "intense";
  return "run";
}

export function buildHeatmapDay(
  person: PersonKey,
  input: SideLogInput,
  rules: SettlementVisualRules = DEFAULT_VISUAL_RULES,
): HeatmapDay {
  return {
    level: heatLevelFromDeficit(person, input.deficit, rules),
    exercise: exerciseTagFromMinutes(input.minutes, rules),
  };
}

export function getMaySettlementDay(): number {
  const d = new Date();
  return d.getDate();
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

export function getCurrentIsoDate(): string {
  return formatIsoDate(new Date());
}

export function isoDateFromDay(day: number): string {
  return `2026-05-${pad2(day)}`;
}

export function parseIsoDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function dateFromIso(value: string) {
  const parsed = parseIsoDateParts(value);
  if (!parsed) return null;
  return new Date(parsed.year, parsed.month - 1, parsed.day);
}

function addDaysIso(value: string, days: number) {
  const date = dateFromIso(value);
  if (!date) return value;
  date.setDate(date.getDate() + days);
  return formatIsoDate(date);
}

function recordDate(record: PreviousDailyRecord) {
  return record.recordDate ?? isoDateFromDay(record.day);
}

export function getCoinWeekRange(
  targetIsoDate: string,
  weekStartDay = DEFAULT_COIN_RULES.weekStartDay,
): {
  start: string;
  end: string;
} {
  const date = dateFromIso(targetIsoDate) ?? new Date();
  const diffFromSaturday = (date.getDay() - weekStartDay + 7) % 7;
  const startDate = new Date(date);
  startDate.setDate(date.getDate() - diffFromSaturday);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  return {
    start: formatIsoDate(startDate),
    end: formatIsoDate(endDate),
  };
}

export function isInCoinWeek(
  recordIsoDate: string,
  targetIsoDate: string,
  weekStartDay = DEFAULT_COIN_RULES.weekStartDay,
) {
  const range = getCoinWeekRange(targetIsoDate, weekStartDay);
  return recordIsoDate >= range.start && recordIsoDate <= range.end;
}

export type CoupleBonusResult = {
  gems: number;
  reasons: string[];
};

export function computeCoupleBonus(
  fish: SideLogInput,
  cat: SideLogInput,
): CoupleBonusResult {
  if (
    !hasDeficit(fish) ||
    !hasDeficit(cat) ||
    fish.minutes < 30 ||
    cat.minutes < 30
  ) {
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

function reachesOkLevel(
  person: PersonKey,
  deficit: number,
  visualRules: SettlementVisualRules,
) {
  return deficit >= visualRules.heatmap[person].okMin;
}

function bothReachedOkLevel(
  record: PreviousDailyRecord,
  visualRules: SettlementVisualRules,
) {
  return (
    reachesOkLevel("fish", record.fish.deficit, visualRules) &&
    reachesOkLevel("cat", record.cat.deficit, visualRules)
  );
}

function bothExercised(record: PreviousDailyRecord) {
  return record.fish.minutes >= 30 && record.cat.minutes >= 30;
}

function recordsInCurrentWeek(
  records: PreviousDailyRecord[],
  todayDate: string,
  coinRules: CoinRulesConfig,
) {
  const range = getCoinWeekRange(todayDate, coinRules.weekStartDay);
  return records.filter((record) => {
    const date = recordDate(record);
    return date >= range.start && date < todayDate;
  });
}

function countDeficitStreakBeforeToday(
  records: PreviousDailyRecord[],
  todayDate: string,
  coinRules: CoinRulesConfig,
  visualRules: SettlementVisualRules,
) {
  let streak = 0;
  const range = getCoinWeekRange(todayDate, coinRules.weekStartDay);
  for (let date = addDaysIso(todayDate, -1); ; date = addDaysIso(date, -1)) {
    if (date < range.start) break;
    const record = records.find((item) => recordDate(item) === date);
    if (!record || !bothReachedOkLevel(record, visualRules)) break;
    streak += 1;
  }
  return streak;
}

export function computeCoinPreview({
  fish,
  cat,
  todayDay,
  todayDate,
  todayGemTotal,
  currentWeekGemTotal,
  dailyRecords,
  coinRules = DEFAULT_COIN_RULES,
  visualRules = DEFAULT_VISUAL_RULES,
}: CoinRuleContext): CoinPreview {
  let delta = 0;
  const bits: string[] = [];
  const nextWeekGemTotal = currentWeekGemTotal + todayGemTotal;
  const currentDate = todayDate ?? isoDateFromDay(todayDay);

  if (currentWeekGemTotal < 30 && nextWeekGemTotal >= 30) {
    delta += 1;
    bits.push("本周新增金币达到 30：+1");
  }

  if (currentWeekGemTotal < 50 && nextWeekGemTotal >= 50) {
    delta += 1;
    bits.push("本周新增金币达到 50：再 +1");
  }

  const todayBothReachedOk =
    reachesOkLevel("fish", fish.deficit, visualRules) &&
    reachesOkLevel("cat", cat.deficit, visualRules);
  const deficitStreak = todayBothReachedOk
    ? countDeficitStreakBeforeToday(
        dailyRecords,
        currentDate,
        coinRules,
        visualRules,
      ) + 1
    : 0;
  if (deficitStreak === coinRules.deficitStreakDays) {
    delta += 1;
    bits.push(`双人连续 ${coinRules.deficitStreakDays} 天达到一般打卡：+1`);
  }

  const weekRecords = recordsInCurrentWeek(
    dailyRecords,
    currentDate,
    coinRules,
  );
  const previousTogetherExerciseCount = weekRecords.filter(bothExercised).length;
  const todayTogetherExercise = fish.minutes >= 30 && cat.minutes >= 30;
  const nextTogetherExerciseCount =
    previousTogetherExerciseCount + (todayTogetherExercise ? 1 : 0);
  if (previousTogetherExerciseCount < 2 && nextTogetherExerciseCount >= 2) {
    delta += 1;
    bits.push("本周一起运动达到 2 次：+1");
  }

  if (delta === 0) {
    return { delta: 0, hint: "本日暂未触发宝石规则" };
  }

  return { delta, hint: bits.join(" · ") };
}
