import { NextResponse } from "next/server";
import { parseMoodWritePayload } from "../../../../lib/life/life-service";
import {
  authorizePersonalPartnerWrite,
  LIFE_NO_STORE_HEADERS,
  lifeCloudErrorResponse,
  lifeJsonError,
  readJsonBody,
} from "../../../../lib/server/life-api";
import { LifeCloudError, upsertMood } from "../../../../lib/server/supabase-life";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const manualPayload =
    typeof body.value === "object" && body.value !== null && !Array.isArray(body.value)
      ? { ...body.value, source: "manual", idempotencyKey: undefined }
      : body.value;
  const parsed = parseMoodWritePayload(manualPayload);
  if (!parsed.ok) {
    return lifeJsonError(parsed.reason, 400, "INVALID_MOOD");
  }

  const authError = await authorizePersonalPartnerWrite(request, parsed.value.partnerKey);
  if (authError) return authError;

  try {
    const mood = await upsertMood(parsed.value);
    return NextResponse.json(
      { ok: true, mood },
      { headers: LIFE_NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof LifeCloudError) return lifeCloudErrorResponse(error);
    return lifeJsonError("写入心情记录失败", 502, "LIFE_WRITE_FAILED");
  }
}
