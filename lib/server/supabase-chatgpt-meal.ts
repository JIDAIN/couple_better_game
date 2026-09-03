import type { MealRecord, MealWritePayload } from "@/lib/nutrition/meal-service";

const DEFAULT_SUPABASE_URL = "https://bfhntnzngozdqsmgfvjk.supabase.co";
const DEFAULT_SPACE_SLUG = "couple-better-game";

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function config() {
  const url = env("SUPABASE_URL") || DEFAULT_SUPABASE_URL;
  const secret = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  const spaceSlug = env("COUPLE_SPACE_SLUG") || DEFAULT_SPACE_SLUG;
  if (!secret) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  return { url, secret, spaceSlug };
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { url, secret } = config();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(error?.message ?? "CHATGPT_MEAL_RPC_FAILED");
  }
  return response.json() as Promise<T>;
}

export function createChatgptMeal(payload: MealWritePayload, idempotencyKey: string) {
  const { spaceSlug } = config();
  return rpc<MealRecord>("create_chatgpt_meal_record", {
    p_payload: payload,
    p_idempotency_key: idempotencyKey,
    p_space_slug: spaceSlug,
  });
}

export function getChatgptMeal(idempotencyKey: string) {
  const { spaceSlug } = config();
  return rpc<MealRecord | null>("get_chatgpt_meal_record", {
    p_idempotency_key: idempotencyKey,
    p_space_slug: spaceSlug,
  });
}
