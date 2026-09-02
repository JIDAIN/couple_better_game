import { NextResponse } from "next/server";
import { isUuid, parseMealWritePayload } from "../../../../lib/nutrition/meal-service";
import { requireLifeIdentity } from "../../../../lib/server/life-api";
import { mealOwnerKey } from "../../../../lib/server/life-record-owner";
import { deleteMeal, NutritionCloudError, updateMeal } from "../../../../lib/server/supabase-nutrition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function jsonError(message: string, status: number, errorCode: string) {
  return NextResponse.json({ ok: false, error: message, errorCode }, { status });
}

function nutritionErrorResponse(error: NutritionCloudError) {
  const status = error.errorCode === "SERVER_CONFIG" ? 500 : error.message.includes("Meal not found") ? 404 : error.message.includes("Idempotency key") ? 409 : 502;
  return jsonError(error.message, status, error.errorCode);
}

async function readMealId(context: RouteContext) {
  const { id } = await context.params;
  return isUuid(id) ? id : null;
}

async function authorizeMealOwner(request: Request, mealId: string) {
  const auth = await requireLifeIdentity(request);
  if (auth.response) return { identity: null, response: auth.response };
  const owner = await mealOwnerKey(mealId);
  if (!owner) return { identity: null, response: jsonError("餐食不存在", 404, "NOT_FOUND") };
  if (owner !== auth.identity.partnerKey) {
    return { identity: null, response: jsonError("只能修改自己的饮食记录", 403, "FORBIDDEN") };
  }
  return { identity: auth.identity, response: null };
}

export async function PUT(request: Request, context: RouteContext) {
  const mealId = await readMealId(context);
  if (!mealId) return jsonError("餐食 ID 格式不正确", 400, "BAD_REQUEST");
  const auth = await authorizeMealOwner(request, mealId);
  if (auth.response) return auth.response;

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("请求格式不正确", 400, "BAD_REQUEST"); }
  const parsed = parseMealWritePayload(body);
  if (!parsed.ok) return jsonError(parsed.reason, 400, "INVALID_MEAL");

  try {
    const meal = await updateMeal(mealId, { ...parsed.value, partnerKey: auth.identity!.partnerKey! });
    return NextResponse.json({ ok: true, meal }, { headers: { "Cache-Control": "no-store, max-age=0", "X-Couple-Data-Source": "supabase" } });
  } catch (error) {
    if (error instanceof NutritionCloudError) return nutritionErrorResponse(error);
    return jsonError("更新饮食数据失败", 502, "NUTRITION_WRITE_FAILED");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const mealId = await readMealId(context);
  if (!mealId) return jsonError("餐食 ID 格式不正确", 400, "BAD_REQUEST");
  const auth = await authorizeMealOwner(request, mealId);
  if (auth.response) return auth.response;

  try {
    const meal = await deleteMeal(mealId);
    return NextResponse.json({ ok: true, meal }, { headers: { "Cache-Control": "no-store, max-age=0", "X-Couple-Data-Source": "supabase" } });
  } catch (error) {
    if (error instanceof NutritionCloudError) return nutritionErrorResponse(error);
    return jsonError("删除饮食数据失败", 502, "NUTRITION_WRITE_FAILED");
  }
}
