/** 单日热量缺口完成程度（热力图底色） */
export type HeatLevel =
  | "empty"
  | "over-light"
  | "over-mid"
  | "over-strong"
  | "over-heavy"
  | "none"
  | "ok"
  | "good"
  | "perfect";

/** 运动角标 */
export type ExerciseTag = "none" | "run" | "intense";

export type HeatmapDay = {
  level: HeatLevel;
  exercise: ExerciseTag;
};

export type PersonKey = "fish" | "cat";

export type SideLogInput = {
  weightKg: number | null;
  deficit: number;
  minutes: number;
};

export type CoinRulesConfig = {
  weekStartDay: number;
  deficitStreakDays: number;
};

export type HeatmapThresholds = {
  noneMax: number;
  okMin: number;
  goodMin: number;
  perfectMin: number;
};

export type ExerciseTagThresholds = {
  runMin: number;
  intenseMin: number;
};

export type SettlementVisualRules = {
  heatmap: Record<PersonKey, HeatmapThresholds>;
  exerciseTag: ExerciseTagThresholds;
};

export type Wallet = { gems: number; coins: number };

export type ResourceKind = "gem" | "coin";

export type HeatmapDayOverrides = Partial<Record<number, HeatmapDay>>;

export type ExchangeCategory = {
  id: string;
  title: string;
  icon: string;
  description: string;
  resourceKind: ResourceKind;
  price: number;
};

export type ExchangeRecord = {
  id: string;
  date: string;
  createdAt: string;
  occurredAt: string;
  time: string;
  category: string;
  remark: string;
  resourceKind: ResourceKind;
  price: number;
  icon: string;
};

export type DailyRecordSide = {
  weightKg: number | null;
  deficit: number;
  minutes: number;
  gems: number;
};

export type DailyRecord = {
  id: string;
  date: string;
  recordDate: string;
  createdAt: string;
  day: number;
  fish: DailyRecordSide;
  cat: DailyRecordSide;
  bonus: number;
  coins: number;
  fishHeat: HeatmapDay;
  catHeat: HeatmapDay;
};

export type TodayRecordSidePayload = {
  weightKg: number | null;
  deficit: number;
  minutes: number;
};

export type TodayRecordPayload = {
  day: number;
  fish: TodayRecordSidePayload;
  cat: TodayRecordSidePayload;
  fishHeat: HeatmapDay;
  catHeat: HeatmapDay;
  fishGems: number;
  catGems: number;
  bonusGems: number;
  coinDelta: number;
};

export type HistoricalRecordPayload = {
  recordDate: string;
  person: PersonKey;
  input: TodayRecordSidePayload;
};

export type HistoricalRecordDraft = {
  recordDate: string;
  fish?: TodayRecordSidePayload | null;
  cat?: TodayRecordSidePayload | null;
};

export type HistoricalRecordResult = {
  ok: boolean;
  updatedExisting: boolean;
  reason?: "future-date" | "invalid-date";
};

export type ExchangeRedeemPayload = {
  category: string;
  remark: string;
  resourceKind: ResourceKind;
  price: number;
  icon: string;
  occurredAt?: string;
};

export type UserRuntimeData = {
  wallet: Wallet;
  streakDays: number;
  weeklySuccessDays: number;
  cumulativeSuccessDays: number;
  yesterdayGemTotal: number;
  todayFishGems: number;
  todayCatGems: number;
  todayBonusGems: number;
  weekGemTotal: number;
  weekCoinTotal: number;
  fishHeatmapOverrides: HeatmapDayOverrides;
  catHeatmapOverrides: HeatmapDayOverrides;
  dailyRecords: DailyRecord[];
  exchangeRecords: ExchangeRecord[];
};

export type AppConfigData = {
  heatmapStartDate: string;
  coinRules: CoinRulesConfig;
  visualRules: SettlementVisualRules;
  exchangeCategories: ExchangeCategory[];
};

export type HomeResourcesState = UserRuntimeData & AppConfigData;

export type AppDataSnapshot = {
  version: 1;
  currencySemanticsVersion?: number;
  runtime: Partial<UserRuntimeData>;
  config: Partial<AppConfigData>;
};
