import { NextResponse } from "next/server";
import { parseMoodWritePayload } from "../../../../lib/life/life-service";
import {
  authorizePersonalPartnerWrite,
  LIFE_NO_STORE_HEADERS,
  lifeCloudErrorResponse,
  lifeJsonError,
  readJsonBody,
} from "../../../../lib/server/life-api";
import { LifeCloudError, deleteMood, upsertMood } from "../../../../lib/server/supabase-life";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

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

export async function DELETE(request: Request) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const value = body.value && typeof body.value === "object" && !Array.isArray(body.value)
    ? body.value as Record<string, unknown>
    : {};
  const id = value.id;
  const partnerKey = value.partnerKey;
  if (!validUuid(id)) return lifeJsonError("需要有效的心情记录 ID", 400, "INVALID_MOOD_ID");
  if (partnerKey !== "cat" && partnerKey !== "fish") {
    return lifeJsonError("需要有效的账号身份", 400, "INVALID_PARTNER_KEY");
  }

  const authError = await authorizePersonalPartnerWrite(request, partnerKey);
  if (authError) return authError;

  try {
    const mood = await deleteMood(id, partnerKey);
    return NextResponse.json({ ok: true, mood }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof LifeCloudError) return lifeCloudErrorResponse(error);
    return lifeJsonError("删除心情记录失败", 502, "LIFE_WRITE_FAILED");
  }
}
