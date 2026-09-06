import type {
  MealPhotoDisplay,
  MealQuery,
  MealRecord,
  MealWritePayload,
  NutritionPartnerKey,
} from "../nutrition/meal-service";

const DEFAULT_SUPABASE_URL = "https://bfhntnzngozdqsmgfvjk.supabase.co";
const DEFAULT_SPACE_SLUG = "couple-better-game";
const MEAL_PHOTO_BUCKET = "meal-photos";

type RpcErrorBody = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

type MealPhotoReplacement = {
  previousPhotoPath: string | null;
  meal: MealRecord;
};

export class NutritionCloudError extends Error {
  constructor(
    message: string,
    public readonly errorCode:
      | "SERVER_CONFIG"
      | "NUTRITION_READ_FAILED"
      | "NUTRITION_WRITE_FAILED"
      | "PHOTO_READ_FAILED"
      | "PHOTO_WRITE_FAILED"
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

export function coupleSpaceSlug() {
  return env("COUPLE_SPACE_SLUG") || DEFAULT_SPACE_SLUG;
}

function serviceHeaders(extra?: HeadersInit) {
  const secretKey = supabaseSecretKey();
  if (!secretKey) {
    throw new NutritionCloudError(
      "Supabase 服务端环境变量未配置完整",
      "SERVER_CONFIG",
    );
  }
  return {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    ...extra,
  };
}

function storagePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
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
      headers: serviceHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new NutritionCloudError("连接 Supabase 失败", "CLOUD_NETWORK_ERROR");
  }

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as RpcErrorBody | null;
    const fallback = operation === "read" ? "读取饮食数据失败" : "写入饮食数据失败";
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

export async function getMealOwner(mealId: string): Promise<NutritionPartnerKey | null> {
  let response: Response;
  try {
    response = await fetch(
      `${supabaseUrl()}/rest/v1/meals?id=eq.${encodeURIComponent(mealId)}&select=partner_key,deleted_at&limit=1`,
      { headers: serviceHeaders(), cache: "no-store" },
    );
  } catch {
    throw new NutritionCloudError("读取餐食归属时连接失败", "CLOUD_NETWORK_ERROR");
  }
  if (!response.ok) {
    throw new NutritionCloudError("读取餐食归属失败", "NUTRITION_READ_FAILED");
  }
  const rows = (await response.json()) as Array<{ partner_key?: string; deleted_at?: string | null }>;
  const row = rows[0];
  if (!row || row.deleted_at) return null;
  return row.partner_key === "cat" || row.partner_key === "fish" ? row.partner_key : null;
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
  const meal = await callRpc<MealRecord>(
    "delete_meal_record",
    { p_meal_id: mealId, p_space_slug: coupleSpaceSlug() },
    "write",
  );
  if (meal.photoPath) {
    await deleteMealPhotoObject(meal.photoPath).catch(() => undefined);
  }
  return meal;
}

export async function getMealPhotoPath(mealId: string) {
  return callRpc<string | null>(
    "get_meal_photo_path",
    { p_meal_id: mealId, p_space_slug: coupleSpaceSlug() },
    "read",
  );
}

export async function replaceMealPhotoState(
  mealId: string,
  photoPath: string | null,
  display: MealPhotoDisplay,
) {
  return callRpc<MealPhotoReplacement>(
    "replace_meal_photo_state",
    {
      p_meal_id: mealId,
      p_photo_path: photoPath,
      p_rotation_degrees: display.rotationDegrees,
      p_scale: display.scale,
      p_space_slug: coupleSpaceSlug(),
    },
    "write",
  );
}

export async function updateMealPhotoDisplay(mealId: string, display: MealPhotoDisplay) {
  return callRpc<MealRecord>(
    "update_meal_photo_display",
    {
      p_meal_id: mealId,
      p_rotation_degrees: display.rotationDegrees,
      p_scale: display.scale,
      p_space_slug: coupleSpaceSlug(),
    },
    "write",
  );
}

export function buildMealPhotoPath(mealId: string, extension: string) {
  const safeExtension = extension.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!safeExtension) throw new Error("照片扩展名不正确");
  return `${coupleSpaceSlug()}/${mealId}/${crypto.randomUUID()}.${safeExtension}`;
}

export async function uploadMealPhotoObject(
  path: string,
  bytes: ArrayBuffer,
  contentType: string,
) {
  let response: Response;
  try {
    response = await fetch(
      `${supabaseUrl()}/storage/v1/object/${MEAL_PHOTO_BUCKET}/${storagePath(path)}`,
      {
        method: "POST",
        headers: serviceHeaders({
          "Content-Type": contentType,
          "x-upsert": "false",
          "Cache-Control": "3600",
        }),
        body: bytes,
        cache: "no-store",
      },
    );
  } catch {
    throw new NutritionCloudError("上传餐食照片时连接失败", "CLOUD_NETWORK_ERROR");
  }
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as RpcErrorBody | null;
    throw new NutritionCloudError(result?.message ?? "上传餐食照片失败", "PHOTO_WRITE_FAILED");
  }
}

export async function downloadMealPhotoObject(path: string) {
  let response: Response;
  try {
    response = await fetch(
      `${supabaseUrl()}/storage/v1/object/authenticated/${MEAL_PHOTO_BUCKET}/${storagePath(path)}`,
      {
        method: "GET",
        headers: serviceHeaders(),
        cache: "no-store",
      },
    );
  } catch {
    throw new NutritionCloudError("读取餐食照片时连接失败", "CLOUD_NETWORK_ERROR");
  }
  if (!response.ok) {
    throw new NutritionCloudError("读取餐食照片失败", "PHOTO_READ_FAILED");
  }
  return response;
}

export async function deleteMealPhotoObject(path: string) {
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl()}/storage/v1/object/${MEAL_PHOTO_BUCKET}`, {
      method: "DELETE",
      headers: serviceHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: [path] }),
      cache: "no-store",
    });
  } catch {
    throw new NutritionCloudError("删除餐食照片时连接失败", "CLOUD_NETWORK_ERROR");
  }
  if (!response.ok) {
    throw new NutritionCloudError("删除餐食照片失败", "PHOTO_WRITE_FAILED");
  }
}
