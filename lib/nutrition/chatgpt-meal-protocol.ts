import {
  parseMealWritePayload,
  type MealWritePayload,
  type NutritionPartnerKey,
} from "./meal-service";

export const CHATGPT_MEAL_IDEMPOTENCY_PREFIX = "chatgpt:";

type PreparationResult =
  | { ok: true; value: MealWritePayload }
  | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isChatgptMealIdempotencyKey(value: string) {
  return (
    value.startsWith(CHATGPT_MEAL_IDEMPOTENCY_PREFIX) &&
    value.length <= 200 &&
    value.trim() === value
  );
}

export function buildChatgptMealIdempotencyKey(
  partnerKey: NutritionPartnerKey,
  mealDate: string,
  confirmationNonce: string,
) {
  const nonce = confirmationNonce
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  if (!nonce) {
    throw new Error("confirmationNonce 不能为空");
  }

  const key = `${CHATGPT_MEAL_IDEMPOTENCY_PREFIX}${partnerKey}:${mealDate}:${nonce}`;
  if (key.length > 200) {
    throw new Error("ChatGPT meal idempotency key 过长");
  }
  return key;
}

/**
 * Canonical P2 preparation step. Call this only after the user has explicitly
 * confirmed that the current meal draft should be persisted.
 *
 * This helper deliberately does not try to infer confirmation language. The
 * conversation layer owns that semantic decision; this function only makes the
 * resulting payload safe and canonical.
 */
export function prepareConfirmedChatgptMeal(
  value: unknown,
  idempotencyKey: string,
): PreparationResult {
  if (!isChatgptMealIdempotencyKey(idempotencyKey)) {
    return {
      ok: false,
      reason: "ChatGPT 餐食幂等键必须以 chatgpt: 开头且不超过 200 个字符",
    };
  }

  if (!isRecord(value)) {
    return { ok: false, reason: "ChatGPT 餐食草稿格式不正确" };
  }

  const parsed = parseMealWritePayload({
    ...value,
    source: "chatgpt",
    status: "confirmed",
    idempotencyKey,
  });
  if (!parsed.ok) return parsed;

  if (parsed.value.items.length === 0) {
    return { ok: false, reason: "ChatGPT 记上时至少需要一个食物明细" };
  }

  const itemTotal = parsed.value.items.reduce(
    (sum, item) => sum + item.caloriesKcal,
    0,
  );
  if (parsed.value.totalCaloriesKcal !== itemTotal) {
    return {
      ok: false,
      reason: "ChatGPT 餐食总热量必须等于食物明细热量之和",
    };
  }

  return { ok: true, value: parsed.value };
}
