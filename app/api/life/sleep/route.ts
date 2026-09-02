import { NextResponse } from "next/server";
import { parseSleepWritePayload } from "../../../../lib/life/life-service";
import {
  LIFE_NO_STORE_HEADERS,
  lifeCloudErrorResponse,
  lifeJsonError,
  readJsonBody,
  requireLifeIdentity,
} from "../../../../lib/server/life-api";
import { LifeCloudError, upsertSleep } from "../../../../lib/server/supabase-life";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const auth = await requireLifeIdentity(request);
  if (auth.response) return auth.response;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const manualPayload =
    typeof body.value === "object" && body.value !== null && !Array.isArray(body.value)
      ? { ...body.value, partnerKey: auth.identity.partnerKey, source: "manual", idempotencyKey: undefined }
      : body.value;
  const parsed = parseSleepWritePayload(manualPayload);
  if (!parsed.ok) return lifeJsonError(parsed.reason, 400, "INVALID_SLEEP");

  try {
    const sleep = await upsertSleep(parsed.value);
    return NextResponse.json({ ok: true, sleep }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof LifeCloudError) return lifeCloudErrorResponse(error);
    return lifeJsonError("写入睡眠记录失败", 502, "LIFE_WRITE_FAILED");
  }
}
