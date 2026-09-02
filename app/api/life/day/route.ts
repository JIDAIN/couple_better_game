import { NextResponse } from "next/server";
import { parseLifeDayDate } from "../../../../lib/life/life-service";
import {
  authorizeLifeRequest,
  LIFE_NO_STORE_HEADERS,
  lifeCloudErrorResponse,
  lifeJsonError,
} from "../../../../lib/server/life-api";
import { getLifeDay, LifeCloudError } from "../../../../lib/server/supabase-life";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await authorizeLifeRequest(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const parsedDate = parseLifeDayDate(url.searchParams.get("date"));
  if (!parsedDate.ok) {
    return lifeJsonError(parsedDate.reason, 400, "BAD_REQUEST");
  }

  try {
    const day = await getLifeDay(parsedDate.value);
    if (!day) {
      return lifeJsonError("情侣空间不存在", 404, "SPACE_NOT_FOUND");
    }
    return NextResponse.json(
      { ok: true, day },
      { headers: LIFE_NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof LifeCloudError) return lifeCloudErrorResponse(error);
    return lifeJsonError("读取生活记录失败", 502, "LIFE_READ_FAILED");
  }
}
