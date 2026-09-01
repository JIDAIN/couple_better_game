import type {
  MealQuery,
  MealRecord,
  MealWritePayload,
} from "../nutrition/meal-service";

const DEFAULT_SUPABASE_URL = "https://bfhntnzngozdqsmgfvjk.supabase.co";
const DEFAULT_SPACE_SLUG = "couple-better-game";

type RpcErrorBody = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

export class NutritionCloudError extends Error {
  constructor(
    message: string,
    public readonly errorCode:
      | "SERVER_CONFIG"
      | "NUTRITION_READ_FAILED"
      | "NUTRITION_WRITE_FAILED"
      | "CLOUD_NETWORK_ERROR",
  ) {
    super(message);
  }
}

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function supabaseUrl() {
  return env("SUPABASE_URL") || DEFAULT_SUPABASE_URL;
}

function supabaseSecretKey() {
  return env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
}

function coupleSpaceSlug() {
  return env("COUPLE_SPACE_SLUG") || DEFAULT_SPACE_SLUG;
}

async function callRpc<T>(
  functionName: string,
  body: Record<string, unknown>,
  operation: "read" | "write",
): Promise<T> {
  const url = supabaseUrl();
  const secretKey = supabaseSecretKey();
  if (!url || !secretKey) {
    throw new NutritionCloudError(
      "Supabase 服务端环境变量未配置完整",
      "SERVER_CONFIG",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new NutritionCloudError("连接 Supabase 失败", "CLOUD_NETWORK_ERROR");
  }

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as RpcErrorBody | null;
    const fallback =
      operation === "read" ? "读取饮食数据失败" : "写入饮食数据失败";
    throw new NutritionCloudError(
      result?.message ?? fallback,
      operation === "read" ? "NUTRITION_READ_FAILED" : "NUTRITION_WRITE_FAILED",
    );
  }

  return (await response.json()) as T;
}

export async function listMeals(query: MealQuery) {
  return callRpc<MealRecord[]>(
    "list_meals",
    {
      p_space_slug: coupleSpaceSlug(),
      p_partner_key: query.partnerKey,
      p_meal_date: query.mealDate,
    },
    "read",
  );
}

export async function createMeal(payload: MealWritePayload) {
  return callRpc<MealRecord>(
    "create_meal_record",
    { p_payload: payload, p_space_slug: coupleSpaceSlug() },
    "write",
  );
}

export async function updateMeal(mealId: string, payload: MealWritePayload) {
  return callRpc<MealRecord>(
    "update_meal_record",
    {
      p_meal_id: mealId,
      p_payload: payload,
      p_space_slug: coupleSpaceSlug(),
    },
    "write",
  );
}

export async function deleteMeal(mealId: string) {
  return callRpc<MealRecord>(
    "delete_meal_record",
    { p_meal_id: mealId, p_space_slug: coupleSpaceSlug() },
    "write",
  );
}
