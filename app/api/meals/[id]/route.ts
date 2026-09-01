import { NextResponse } from "next/server";
import {
  isUuid,
  parseMealWritePayload,
} from "../../../../lib/nutrition/meal-service";
import { isAuthorizedCloudRequest } from "../../../../lib/server/cloud-request-auth";
import {
  deleteMeal,
  NutritionCloudError,
  updateMeal,
} from "../../../../lib/server/supabase-nutrition";
import { hasCloudSyncConfig } from "../../../../lib/server/supabase-home-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function jsonError(message: string, status: number, errorCode: string) {
  return NextResponse.json({ ok: false, error: message, errorCode }, { status });
}

function nutritionErrorResponse(error: NutritionCloudError) {
  const status =
    error.errorCode === "SERVER_CONFIG"
      ? 500
      : error.message.includes("Meal not found")
        ? 404
        : error.message.includes("Idempotency key")
          ? 409
          : 502;
  return jsonError(error.message, status, error.errorCode);
}

async function authorize(request: Request) {
  if (!hasCloudSyncConfig()) {
    return jsonError(
      "Supabase 服务端环境变量未配置完整",
      500,
      "SERVER_CONFIG",
    );
  }
  if (!(await isAuthorizedCloudRequest(request))) {
    return jsonError("同步密码不正确或云端会话无效", 401, "UNAUTHORIZED");
  }
  return null;
}

async function readMealId(context: RouteContext) {
  const { id } = await context.params;
  return isUuid(id) ? id : null;
}

export async function PUT(request: Request, context: RouteContext) {
  const authError = await authorize(request);
  if (authError) return authError;

  const mealId = await readMealId(context);
  if (!mealId) {
    return jsonError("餐食 ID 格式不正确", 400, "BAD_REQUEST");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("请求格式不正确", 400, "BAD_REQUEST");
  }

  const parsed = parseMealWritePayload(body);
  if (!parsed.ok) {
    return jsonError(parsed.reason, 400, "INVALID_MEAL");
  }

  try {
    const meal = await updateMeal(mealId, parsed.value);
    return NextResponse.json(
      { ok: true, meal },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Couple-Data-Source": "supabase",
        },
      },
    );
  } catch (error) {
    if (error instanceof NutritionCloudError) {
      return nutritionErrorResponse(error);
    }
    return jsonError("更新饮食数据失败", 502, "NUTRITION_WRITE_FAILED");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authError = await authorize(request);
  if (authError) return authError;

  const mealId = await readMealId(context);
  if (!mealId) {
    return jsonError("餐食 ID 格式不正确", 400, "BAD_REQUEST");
  }

  try {
    const meal = await deleteMeal(mealId);
    return NextResponse.json(
      { ok: true, meal },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Couple-Data-Source": "supabase",
        },
      },
    );
  } catch (error) {
    if (error instanceof NutritionCloudError) {
      return nutritionErrorResponse(error);
    }
    return jsonError("删除饮食数据失败", 502, "NUTRITION_WRITE_FAILED");
  }
}
