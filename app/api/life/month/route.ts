import { NextResponse } from "next/server";
import { monthStartDate, parseLifeMonth } from "../../../../lib/life/calendar-service";
import {
  authorizeLifeRequest,
  LIFE_NO_STORE_HEADERS,
  lifeCloudErrorResponse,
  lifeJsonError,
} from "../../../../lib/server/life-api";
import { getLifeMonthMoods, LifeCloudError } from "../../../../lib/server/supabase-life";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await authorizeLifeRequest(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const parsed = parseLifeMonth(url.searchParams.get("month"));
  if (!parsed.ok) return lifeJsonError(parsed.reason, 400, "BAD_REQUEST");

  try {
    const month = await getLifeMonthMoods(monthStartDate(parsed.value));
    if (!month) return lifeJsonError("情侣空间不存在", 404, "SPACE_NOT_FOUND");
    return NextResponse.json({ ok: true, month }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof LifeCloudError) return lifeCloudErrorResponse(error);
    return lifeJsonError("读取月度心情失败", 502, "LIFE_READ_FAILED");
  }
}
