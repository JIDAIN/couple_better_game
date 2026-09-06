import { MOOD_LABELS, type MoodKey } from "../life/mood-labels";

type JsonRecord = Record<string, unknown>;

type NormalizeContext = {
  latestUserText: string;
  actor: "cat" | "fish";
  hasAttachment?: boolean;
  now?: Date;
};

export class LifeClarificationError extends Error {
  readonly code = "LIFE_CLARIFICATION_REQUIRED";
  readonly question: string;
  readonly missing: string[];

  constructor(question: string, missing: string[] = []) {
    super(`需要向用户确认：${question}`);
    this.name = "LifeClarificationError";
    this.question = question;
    this.missing = missing;
  }
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function first(row: JsonRecord, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return undefined;
}

function shanghaiParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return { year: get("year"), month: get("month"), day: get("day") };
}

function dateInShanghai(now = new Date(), offsetDays = 0) {
  const { year, month, day } = shanghaiParts(now);
  const base = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}

function inferDate(explicit: unknown, userText: string, now: Date) {
  const value = text(explicit);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/前天/.test(userText)) return dateInShanghai(now, -2);
  if (/昨天|昨日/.test(userText)) return dateInShanghai(now, -1);
  return dateInShanghai(now, 0);
}

function normalizePerson(value: unknown, allowAll: boolean) {
  const raw = text(value).toLowerCase();
  if (!raw || ["me", "我", "自己", "本人", "我的"].includes(raw)) return "me";
  if (["ta", "她", "他", "对象", "伴侣", "另一半", "对方"].includes(raw)) return "ta";
  if (allowAll && ["all", "双方", "我们", "两个人", "两人", "全部"].includes(raw)) return "all";
  if (raw === "cat" || raw === "fish") return raw;
  return value;
}

function normalizeAction(resource: string, value: unknown, id: unknown) {
  const raw = text(value).toLowerCase();
  const aliases: Record<string, string> = {
    新增: "create", 添加: "create", 记录: "create", 保存: "create", 创建: "create",
    修改: "update", 更新: "update", 编辑: "update",
    删除: "delete", 删掉: "delete", 移除: "delete",
    覆盖: "replace",
  };
  if (aliases[raw]) return aliases[raw];
  if (["create", "update", "delete", "upsert", "replace"].includes(raw)) return raw;
  if (resource === "mood" || resource === "sleep") return "upsert";
  if (resource === "settings") return "update";
  if (resource === "legacy_home") return "replace";
  return text(id) ? "update" : "create";
}

function normalizeResource(value: unknown, mode: "query" | "mutate") {
  const raw = text(value).toLowerCase();
  const common: Record<string, string> = {
    心情: "mood",
    情绪: "mood",
    睡眠: "sleep",
    活动: "activity",
    三餐: "meal", 餐食: "meal", 饮食: "meal", 吃饭: "meal",
    体重: "weight",
    药箱: "medicine", 药品: "medicine", 药物: "medicine",
    信箱: "mailbox", 小信箱: "mailbox", 信件: "mailbox",
    设置: "settings",
    今日: "day", 日汇总: "day", 生活记录: "day",
  };
  const normalized = common[raw] || raw;
  if (mode === "mutate" && normalized === "day") return raw;
  return normalized;
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = text(value).replace(/,/g, "");
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseDurationMinutes(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const raw = text(value);
  if (!raw) return undefined;
  const hours = raw.match(/(\d+(?:\.\d+)?)\s*(?:小时|h|hr)/i);
  const minutes = raw.match(/(\d+(?:\.\d+)?)\s*(?:分钟|min|mins)/i);
  if (hours || minutes) {
    return Math.round((hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0));
  }
  const numeric = parseNumber(raw);
  return numeric == null ? value : Math.round(numeric);
}

function normalizeClock(value: unknown, date: string, nextDay = false) {
  const raw = text(value);
  if (!raw) return undefined;
  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [hour, minute] = raw.split(":").map(Number);
    if (hour > 23 || minute > 59) return value;
    const base = new Date(`${date}T00:00:00+08:00`);
    if (nextDay) base.setUTCDate(base.getUTCDate() + 1);
    const parts = shanghaiParts(base);
    const targetDate = `${parts.year}-${parts.month}-${parts.day}`;
    return `${targetDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`;
  }
  return value;
}

const MOOD_ALIASES: Record<string, MoodKey> = Object.fromEntries(
  Object.entries(MOOD_LABELS).flatMap(([key, label]) => [
    [key.toLowerCase(), key as MoodKey],
    [label, key as MoodKey],
  ]),
) as Record<string, MoodKey>;

function normalizeMoodKey(value: unknown) {
  const raw = text(value);
  return MOOD_ALIASES[raw.toLowerCase()] || MOOD_ALIASES[raw] || value;
}

function normalizeMealType(value: unknown, userText: string) {
  const raw = text(value).toLowerCase();
  const source = `${raw} ${userText}`;
  if (/早餐|早饭|breakfast/i.test(source)) return "breakfast";
  if (/午餐|午饭|lunch/i.test(source)) return "lunch";
  if (/晚餐|晚饭|dinner/i.test(source)) return "dinner";
  if (/加餐|零食|夜宵|宵夜|snack/i.test(source)) return "snack";
  return raw || "other";
}

function normalizeMealItem(input: unknown) {
  if (typeof input === "string") {
    const rawName = input.trim();
    return rawName ? { rawName, displayName: rawName } : null;
  }
  const row = record(input);
  const rawName = text(first(row, ["rawName", "name", "foodName", "displayName", "food", "title"]));
  if (!rawName) return null;
  const amount = first(row, ["amount", "count", "number"]);
  const unit = text(first(row, ["unit", "measureUnit"]));
  const quantity = first(row, ["portionDescription", "quantity", "portion", "serving"]);
  const portionDescription = text(quantity) || (amount != null ? `${amount}${unit || ""}` : "");
  const result: JsonRecord = {
    ...row,
    rawName,
    displayName: text(row.displayName) || rawName,
  };
  if (portionDescription) result.portionDescription = portionDescription;
  const aliasNumbers: Array<[string, string[]]> = [
    ["estimatedWeightG", ["estimatedWeightG", "weightG", "grams", "weight"]],
    ["caloriesKcal", ["caloriesKcal", "calories", "kcal"]],
    ["proteinG", ["proteinG", "protein"]],
    ["carbsG", ["carbsG", "carbs", "carbohydrate"]],
    ["fatG", ["fatG", "fat"]],
  ];
  for (const [target, keys] of aliasNumbers) {
    const n = parseNumber(first(row, keys));
    if (n != null) result[target] = n;
  }
  return result;
}

export function normalizeLifeQueryArgs(args: unknown, context: NormalizeContext) {
  const row = record(args);
  const resource = normalizeResource(row.resource, "query");
  const now = context.now || new Date();
  const out: JsonRecord = { ...row, resource };
  if (["day", "mood", "sleep", "activity", "meal"].includes(resource)) {
    out.date = inferDate(first(row, ["date", "mealDate", "moodDate", "sleepDate", "activityDate"]), context.latestUserText, now);
  }
  if (resource === "month") {
    const explicit = text(first(row, ["monthStart", "month", "date"]));
    out.monthStart = /^\d{4}-\d{2}-01$/.test(explicit)
      ? explicit
      : `${dateInShanghai(now).slice(0, 7)}-01`;
  }
  if (["day", "mood", "sleep", "activity", "meal"].includes(resource)) {
    out.person = normalizePerson(first(row, ["person", "owner", "who"]), true);
  }
  if (resource === "weight") {
    out.person = normalizePerson(first(row, ["person", "owner", "who"]), false);
    const explicitDate = text(first(row, ["date", "measurementDate"]));
    if (explicitDate || /今天|昨天|昨日|前天/.test(context.latestUserText)) {
      out.date = inferDate(explicitDate, context.latestUserText, now);
    }
    const dateFrom = text(first(row, ["dateFrom", "from", "startDate"]));
    const dateTo = text(first(row, ["dateTo", "to", "endDate"]));
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) out.dateFrom = dateFrom;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) out.dateTo = dateTo;
  }
  if (resource === "medicine") {
    const name = text(first(row, ["name", "query", "keyword", "medicineName", "drugName"]));
    if (name) out.name = name;
  }
  return out;
}

export function normalizeLifeMutationArgs(args: unknown, context: NormalizeContext) {
  const row = record(args);
  const resource = normalizeResource(row.resource, "mutate");
  const now = context.now || new Date();
  const id = first(row, ["id", "recordId"]);
  const action = normalizeAction(resource, row.action, id);
  const sourceData = record(row.data);
  const data: JsonRecord = { ...sourceData };

  if (action === "delete") {
    return {
      ...row,
      resource,
      action,
      ...(id ? { id } : {}),
      data,
    };
  }

  const today = inferDate(first(sourceData, ["date", "mealDate", "moodDate", "sleepDate", "activityDate", "measurementDate"]), context.latestUserText, now);

  if (resource === "mood") {
    data.moodDate = today;
    data.moodKey = normalizeMoodKey(first(sourceData, ["moodKey", "mood", "key", "label", "emotion"]));
    if (!text(data.moodKey)) throw new LifeClarificationError("你想记录什么心情？", ["mood"]);
  }

  if (resource === "sleep") {
    data.sleepDate = today;
    const bedtimeRaw = first(sourceData, ["fellAsleepAt", "bedtime", "sleepTime", "startTime"]);
    const wakeRaw = first(sourceData, ["wokeAt", "wakeTime", "endTime"]);
    if (!text(bedtimeRaw) || !text(wakeRaw)) {
      throw new LifeClarificationError(
        !text(bedtimeRaw) && !text(wakeRaw) ? "请告诉我入睡时间和起床时间。" : !text(bedtimeRaw) ? "请告诉我大约几点入睡。" : "请告诉我大约几点起床。",
        [!text(bedtimeRaw) ? "bedtime" : "", !text(wakeRaw) ? "wakeTime" : ""].filter(Boolean),
      );
    }
    const bedtimeClock = text(bedtimeRaw);
    const wakeClock = text(wakeRaw);
    const bedtimeHour = /^\d{1,2}:\d{2}$/.test(bedtimeClock) ? Number(bedtimeClock.split(":")[0]) : null;
    const wakeHour = /^\d{1,2}:\d{2}$/.test(wakeClock) ? Number(wakeClock.split(":")[0]) : null;
    data.fellAsleepAt = normalizeClock(bedtimeRaw, today, false);
    data.wokeAt = normalizeClock(wakeRaw, today, bedtimeHour != null && wakeHour != null && wakeHour <= bedtimeHour);
  }

  if (resource === "activity") {
    data.activityDate = today;
    data.text = text(first(sourceData, ["text", "name", "title", "description", "content", "activity"])) || data.text;
    if (!text(data.text)) throw new LifeClarificationError("想记录什么活动？", ["activity"]);
    const scopeRaw = text(first(sourceData, ["participantScope", "person", "who", "participants"])).toLowerCase();
    if (!scopeRaw || ["me", "我", "自己", "本人"].includes(scopeRaw)) data.participantScope = context.actor;
    else if (["all", "both", "双方", "我们", "一起", "两个人"].includes(scopeRaw)) data.participantScope = "both";
    else if (["ta", "她", "他", "对象", "伴侣"].includes(scopeRaw) || scopeRaw === (context.actor === "cat" ? "fish" : "cat")) {
      throw new Error("个人活动不能以当前账号替 Ta 写入；共同活动请明确使用 both/我们");
    }
    const duration = parseDurationMinutes(first(sourceData, ["durationMinutes", "duration", "minutes", "timeSpent"]));
    if (duration !== undefined) data.durationMinutes = duration;
  }

  if (resource === "meal") {
    data.mealDate = today;
    data.mealType = normalizeMealType(first(sourceData, ["mealType", "type", "meal", "mealName"]), context.latestUserText);
    const rawItems = Array.isArray(sourceData.items) ? sourceData.items : [];
    const normalizedItems = rawItems.map(normalizeMealItem).filter(Boolean);
    if (!normalizedItems.length) {
      const topName = first(sourceData, ["name", "foodName", "rawName", "food"]);
      const topItem = normalizeMealItem(topName ? { ...sourceData, rawName: topName } : null);
      if (topItem) normalizedItems.push(topItem);
    }
    data.items = normalizedItems;
    if (!normalizedItems.length && !(row.attachPhoto === true || context.hasAttachment)) {
      throw new LifeClarificationError("这顿饭吃了什么？", ["items"]);
    }
  }

  if (resource === "weight") {
    data.measurementDate = today;
    const weight = parseNumber(first(sourceData, ["weightKg", "weight", "kg", "value"]));
    if (weight == null) throw new LifeClarificationError("要记录多少公斤？", ["weightKg"]);
    data.weightKg = weight;
  }

  if (resource === "medicine") {
    data.name = text(first(sourceData, ["name", "medicineName", "drugName", "title", "medicine"]));
    if (!data.name) throw new LifeClarificationError("要记录哪种药？", ["name"]);
    const quantity = parseNumber(first(sourceData, ["quantity", "count", "amount", "number"]));
    if (quantity != null) data.quantity = quantity;
    else if (action === "create" && data.quantity == null) data.quantity = 1;
    const dateAliases: Array<[string, string[]]> = [
      ["productionDate", ["productionDate", "manufactureDate", "madeDate"]],
      ["packageExpiryDate", ["packageExpiryDate", "expiryDate", "expirationDate", "expiresAt"]],
      ["openedDate", ["openedDate", "openDate"]],
    ];
    for (const [target, keys] of dateAliases) {
      const value = first(sourceData, keys);
      if (value != null && value !== "") data[target] = value;
    }
    const numericAliases: Array<[string, string[]]> = [
      ["shelfLifeMonths", ["shelfLifeMonths", "shelfLife", "shelfMonths"]],
      ["openedShelfLifeDays", ["openedShelfLifeDays", "openedShelfLife", "openShelfDays"]],
    ];
    for (const [target, keys] of numericAliases) {
      const value = parseNumber(first(sourceData, keys));
      if (value != null) data[target] = value;
    }
  }

  if (resource === "mailbox") {
    data.body = text(first(sourceData, ["body", "content", "text", "message", "letter"]));
    if (!data.body) throw new LifeClarificationError("想写什么内容？", ["body"]);
    const formatRaw = text(first(sourceData, ["format", "type", "mailType"])).toLowerCase();
    if (/明信片|postcard/.test(formatRaw)) data.format = "postcard";
    else if (!data.format || /信|letter/.test(formatRaw)) data.format = "letter";
    const title = text(first(sourceData, ["title", "subject"]));
    if (title) data.title = title;
  }

  if (resource === "settings") {
    const anniversary = first(sourceData, ["anniversaryDate", "anniversary", "date"]);
    const targetWeight = parseNumber(first(sourceData, ["targetWeightKg", "targetWeight", "weightGoal", "goalWeight"]));
    if (anniversary != null && anniversary !== "") data.anniversaryDate = anniversary;
    if (targetWeight != null) data.targetWeightKg = targetWeight;
    if (!("anniversaryDate" in data) && !("targetWeightKg" in data)) {
      throw new LifeClarificationError("你想修改纪念日还是目标体重？", ["setting"]);
    }
  }

  return {
    ...row,
    resource,
    action,
    ...(id ? { id } : {}),
    data,
  };
}