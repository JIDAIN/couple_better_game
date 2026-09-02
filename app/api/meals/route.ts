import { NextResponse } from "next/server";
import { parseMealQuery, parseMealWritePayload } from "../../../lib/nutrition/meal-service";
import { requireLifeIdentity } from "../../../lib/server/life-api";
import { createMeal, listMeals, NutritionCloudError } from "../../../lib/server/supabase-nutrition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number, errorCode: string) {
  return NextResponse.json({ ok: false, error: message, errorCode }, { status });
}

function nutritionErrorResponse(error: NutritionCloudError) {
  const status = error.errorCode === "SERVER_CONFIG" ? 500 : error.message.includes("Idempotency key") ? 409 : 502;
  return jsonError(error.message, status, error.errorCode);
}

export async function GET(request: Request) {
  const auth = await requireLifeIdentity(request);
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const parsedQuery = parseMealQuery(url.searchParams);
  if (!parsedQuery.ok) return jsonError(parsedQuery.reason, 400, "BAD_REQUEST");

  try {
    const meals = await listMeals(parsedQuery.value);
    return NextResponse.json({ ok: true, meals }, { headers: { "Cache-Control": "no-store, max-age=0", "X-Couple-Data-Source": "supabase" } });
  } catch (error) {
    if (error instanceof NutritionCloudError) return nutritionErrorResponse(error);
    return jsonError("读取饮食数据失败", 502, "NUTRITION_READ_FAILED");
  }
}

export async function POST(request: Request) {
  const auth = await requireLifeIdentity(request);
  if (auth.response) return auth.response;

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("请求格式不正确", 400, "BAD_REQUEST"); }
  const parsed = parseMealWritePayload(body);
  if (!parsed.ok) return jsonError(parsed.reason, 400, "INVALID_MEAL");

  try {
    const meal = await createMeal({ ...parsed.value, partnerKey: auth.identity.partnerKey! });
    return NextResponse.json({ ok: true, meal }, { status: 201, headers: { "Cache-Control": "no-store, max-age=0", "X-Couple-Data-Source": "supabase" } });
  } catch (error) {
    if (error instanceof NutritionCloudError) return nutritionErrorResponse(error);
    return jsonError("写入饮食数据失败", 502, "NUTRITION_WRITE_FAILED");
  }
}
