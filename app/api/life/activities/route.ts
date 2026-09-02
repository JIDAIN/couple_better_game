import { NextResponse } from "next/server";
import { parseActivityWritePayload } from "../../../../lib/life/life-service";
import {
  authorizeLifeRequest,
  LIFE_NO_STORE_HEADERS,
  lifeCloudErrorResponse,
  lifeJsonError,
  readJsonBody,
} from "../../../../lib/server/life-api";
import { createActivity, LifeCloudError } from "../../../../lib/server/supabase-life";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authError = await authorizeLifeRequest(request);
  if (authError) return authError;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const manualPayload =
    typeof body.value === "object" && body.value !== null && !Array.isArray(body.value)
      ? { ...body.value, source: "manual", idempotencyKey: undefined }
      : body.value;
  const parsed = parseActivityWritePayload(manualPayload);
  if (!parsed.ok) {
    return lifeJsonError(parsed.reason, 400, "INVALID_ACTIVITY");
  }

  try {
    const activity = await createActivity(parsed.value);
    return NextResponse.json(
      { ok: true, activity },
      { status: 201, headers: LIFE_NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof LifeCloudError) return lifeCloudErrorResponse(error);
    return lifeJsonError("写入活动记录失败", 502, "LIFE_WRITE_FAILED");
  }
}
