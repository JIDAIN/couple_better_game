export type NutritionPartnerKey = "fish" | "cat";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "other";
export type SnackPeriod = "morning" | "afternoon" | "evening" | "late_night";
export type MealStatus = "draft" | "confirmed";
export type MealSource = "manual" | "chatgpt" | "import";
export type MealPhotoRotation = 0 | 90 | 180 | 270;
export type MealPhotoDisplay = {
  rotationDegrees: MealPhotoRotation;
  scale: number;
};

export const MEAL_PHOTO_SCALE_MIN = 0.6;
export const MEAL_PHOTO_SCALE_MAX = 1;

export type MealItemWrite = {
  foodId: string | null;
  rawName: string;
  displayName: string;
  portionDescription: string | null;
  estimatedWeightG: number | null;
  caloriesKcal: number | null;
  calorieMinKcal: number | null;
  calorieMaxKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export type MealWritePayload = {
  partnerKey: NutritionPartnerKey;
  mealDate: string;
  mealType: MealType;
  eatenAt: string | null;
  snackPeriod: SnackPeriod | null;
  status: MealStatus;
  source: MealSource;
  totalCaloriesKcal: number | null;
  calorieMinKcal: number | null;
  calorieMaxKcal: number | null;
  note: string | null;
  idempotencyKey: string | null;
  items: MealItemWrite[];
};

export type MealItemRecord = MealItemWrite & {
  id: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type MealRecord = Omit<MealWritePayload, "items"> & {
  id: string;
  photoPath: string | null;
  photoRotationDegrees: MealPhotoRotation;
  photoScale: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  items: MealItemRecord[];
};

export type MealQuery = {
  mealDate: string;
  partnerKey: NutritionPartnerKey | null;
};

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

const MEAL_TYPES: readonly MealType[] = ["breakfast", "lunch", "dinner", "snack", "other"];
const SNACK_PERIODS: readonly SnackPeriod[] = ["morning", "afternoon", "evening", "late_night"];
const MEAL_STATUSES: readonly MealStatus[] = ["draft", "confirmed"];
const MEAL_SOURCES: readonly MealSource[] = ["manual", "chatgpt", "import"];
const PARTNER_KEYS: readonly NutritionPartnerKey[] = ["fish", "cat"];
const PHOTO_ROTATIONS: readonly MealPhotoRotation[] = [0, 90, 180, 270];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > maxLength) return null;
  return text;
}

function isIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function defaultMealPhotoDisplay(width: number | null, height: number | null): MealPhotoDisplay {
  return {
    rotationDegrees: width != null && height != null && height > width ? 90 : 0,
    scale: 1,
  };
}

export function parseMealPhotoDisplayPayload(value: unknown): ParseResult<MealPhotoDisplay> {
  if (!isRecord(value)) return { ok: false, reason: "照片显示设置格式不正确" };
  const rotation = Number(value.rotationDegrees);
  if (!PHOTO_ROTATIONS.includes(rotation as MealPhotoRotation)) {
    return { ok: false, reason: "照片旋转角度只能是 0、90、180 或 270 度" };
  }
  const scale = Number(value.scale);
  if (!Number.isFinite(scale) || scale < MEAL_PHOTO_SCALE_MIN || scale > MEAL_PHOTO_SCALE_MAX) {
    return { ok: false, reason: "照片大小需要在 60% 到 100% 之间" };
  }
  return {
    ok: true,
    value: {
      rotationDegrees: rotation as MealPhotoRotation,
      scale: Math.round(scale * 100) / 100,
    },
  };
}

function optionalNonNegativeNumber(value: unknown): ParseResult<number | null> {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return { ok: false, reason: "营养数值必须是非负数字" };
  }
  return { ok: true, value };
}

function optionalNonNegativeInteger(value: unknown): ParseResult<number | null> {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  if (!Number.isInteger(value) || (value as number) < 0) {
    return { ok: false, reason: "热量必须是非负整数" };
  }
  return { ok: true, value: value as number };
}

function parseMealItem(value: unknown, index: number): ParseResult<MealItemWrite> {
  if (!isRecord(value)) return { ok: false, reason: `第 ${index + 1} 个食物明细格式不正确` };

  const rawName = trimText(value.rawName, 200);
  if (!rawName) return { ok: false, reason: `第 ${index + 1} 个食物缺少名称` };

  const foodIdRaw = trimText(value.foodId, 64);
  if (foodIdRaw && !isUuid(foodIdRaw)) {
    return { ok: false, reason: `第 ${index + 1} 个食物 foodId 格式不正确` };
  }

  const calories = optionalNonNegativeInteger(value.caloriesKcal);
  if (!calories.ok) return calories;
  const calorieMin = optionalNonNegativeInteger(value.calorieMinKcal);
  if (!calorieMin.ok) return calorieMin;
  const calorieMax = optionalNonNegativeInteger(value.calorieMaxKcal);
  if (!calorieMax.ok) return calorieMax;

  if (calorieMin.value !== null && calorieMax.value !== null && calorieMin.value > calorieMax.value) {
    return { ok: false, reason: `第 ${index + 1} 个食物的热量区间上下限颠倒` };
  }
  if (calories.value !== null && calorieMin.value !== null && calories.value < calorieMin.value) {
    return { ok: false, reason: `第 ${index + 1} 个食物的估计热量低于区间下限` };
  }
  if (calories.value !== null && calorieMax.value !== null && calories.value > calorieMax.value) {
    return { ok: false, reason: `第 ${index + 1} 个食物的估计热量高于区间上限` };
  }

  const estimatedWeight = optionalNonNegativeNumber(value.estimatedWeightG);
  if (!estimatedWeight.ok) return estimatedWeight;
  const protein = optionalNonNegativeNumber(value.proteinG);
  if (!protein.ok) return protein;
  const carbs = optionalNonNegativeNumber(value.carbsG);
  if (!carbs.ok) return carbs;
  const fat = optionalNonNegativeNumber(value.fatG);
  if (!fat.ok) return fat;

  return {
    ok: true,
    value: {
      foodId: foodIdRaw,
      rawName,
      displayName: trimText(value.displayName, 200) ?? rawName,
      portionDescription: trimText(value.portionDescription, 300),
      estimatedWeightG: estimatedWeight.value,
      caloriesKcal: calories.value,
      calorieMinKcal: calorieMin.value,
      calorieMaxKcal: calorieMax.value,
      proteinG: protein.value,
      carbsG: carbs.value,
      fatG: fat.value,
    },
  };
}

export function parseMealWritePayload(value: unknown): ParseResult<MealWritePayload> {
  if (!isRecord(value)) return { ok: false, reason: "餐食数据格式不正确" };

  if (!PARTNER_KEYS.includes(value.partnerKey as NutritionPartnerKey)) {
    return { ok: false, reason: "partnerKey 只能是 fish 或 cat" };
  }
  const mealDate = trimText(value.mealDate, 10);
  if (!mealDate || !isIsoDate(mealDate)) {
    return { ok: false, reason: "mealDate 必须是 YYYY-MM-DD 格式的有效日期" };
  }
  if (!MEAL_TYPES.includes(value.mealType as MealType)) {
    return { ok: false, reason: "mealType 不正确" };
  }

  const eatenAt = trimText(value.eatenAt, 64);
  if (eatenAt && Number.isNaN(Date.parse(eatenAt))) {
    return { ok: false, reason: "eatenAt 必须是有效时间" };
  }

  let snackPeriod: SnackPeriod | null = null;
  if (value.snackPeriod !== null && value.snackPeriod !== undefined && value.snackPeriod !== "") {
    if (!SNACK_PERIODS.includes(value.snackPeriod as SnackPeriod)) {
      return { ok: false, reason: "snackPeriod 不正确" };
    }
    snackPeriod = value.snackPeriod as SnackPeriod;
  }
  if (value.mealType !== "snack" && snackPeriod !== null) {
    return { ok: false, reason: "只有加餐可以设置 snackPeriod" };
  }

  const rawItems = value.items ?? [];
  if (!Array.isArray(rawItems)) return { ok: false, reason: "items 必须是数组" };
  if (rawItems.length > 50) return { ok: false, reason: "单餐食物明细不能超过 50 项" };

  const items: MealItemWrite[] = [];
  for (let index = 0; index < rawItems.length; index += 1) {
    const parsed = parseMealItem(rawItems[index], index);
    if (!parsed.ok) return parsed;
    items.push(parsed.value);
  }

  const total = optionalNonNegativeInteger(value.totalCaloriesKcal);
  if (!total.ok) return total;
  const allItemCaloriesKnown = items.length > 0 && items.every((item) => item.caloriesKcal !== null);
  const derivedTotal = allItemCaloriesKnown
    ? items.reduce((sum, item) => sum + (item.caloriesKcal ?? 0), 0)
    : null;
  const totalCaloriesKcal = total.value ?? derivedTotal;

  const calorieMin = optionalNonNegativeInteger(value.calorieMinKcal);
  if (!calorieMin.ok) return calorieMin;
  const calorieMax = optionalNonNegativeInteger(value.calorieMaxKcal);
  if (!calorieMax.ok) return calorieMax;

  const derivedMin =
    items.length > 0 && items.every((item) => item.calorieMinKcal !== null)
      ? items.reduce((sum, item) => sum + (item.calorieMinKcal ?? 0), 0)
      : null;
  const derivedMax =
    items.length > 0 && items.every((item) => item.calorieMaxKcal !== null)
      ? items.reduce((sum, item) => sum + (item.calorieMaxKcal ?? 0), 0)
      : null;
  const calorieMinKcal = calorieMin.value ?? derivedMin;
  const calorieMaxKcal = calorieMax.value ?? derivedMax;

  if (calorieMinKcal !== null && calorieMaxKcal !== null && calorieMinKcal > calorieMaxKcal) {
    return { ok: false, reason: "整餐热量区间上下限颠倒" };
  }
  if (totalCaloriesKcal !== null && calorieMinKcal !== null && totalCaloriesKcal < calorieMinKcal) {
    return { ok: false, reason: "整餐估计热量低于区间下限" };
  }
  if (totalCaloriesKcal !== null && calorieMaxKcal !== null && totalCaloriesKcal > calorieMaxKcal) {
    return { ok: false, reason: "整餐估计热量高于区间上限" };
  }

  const status = (value.status ?? "confirmed") as MealStatus;
  if (!MEAL_STATUSES.includes(status)) return { ok: false, reason: "status 不正确" };
  const source = (value.source ?? "manual") as MealSource;
  if (!MEAL_SOURCES.includes(source)) return { ok: false, reason: "source 不正确" };

  const note = trimText(value.note, 2000);
  if (typeof value.note === "string" && value.note.trim().length > 2000) {
    return { ok: false, reason: "note 不能超过 2000 个字符" };
  }
  const idempotencyKey = trimText(value.idempotencyKey, 200);
  if (typeof value.idempotencyKey === "string" && value.idempotencyKey.trim().length > 200) {
    return { ok: false, reason: "idempotencyKey 不能超过 200 个字符" };
  }

  return {
    ok: true,
    value: {
      partnerKey: value.partnerKey as NutritionPartnerKey,
      mealDate,
      mealType: value.mealType as MealType,
      eatenAt,
      snackPeriod,
      status,
      source,
      totalCaloriesKcal,
      calorieMinKcal,
      calorieMaxKcal,
      note,
      idempotencyKey,
      items,
    },
  };
}

export function parseMealQuery(searchParams: URLSearchParams): ParseResult<MealQuery> {
  const mealDate = searchParams.get("date")?.trim() ?? "";
  if (!isIsoDate(mealDate)) {
    return { ok: false, reason: "date 必须是 YYYY-MM-DD 格式的有效日期" };
  }

  const person = searchParams.get("person")?.trim() ?? "";
  if (person && !PARTNER_KEYS.includes(person as NutritionPartnerKey)) {
    return { ok: false, reason: "person 只能是 fish 或 cat" };
  }

  return {
    ok: true,
    value: { mealDate, partnerKey: person ? (person as NutritionPartnerKey) : null },
  };
}
