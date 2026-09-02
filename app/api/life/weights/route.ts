import { NextResponse } from "next/server";
import { LIFE_NO_STORE_HEADERS, lifeJsonError, readJsonBody, requireLifeIdentity } from "../../../../lib/server/life-api";
import { parseWeightPartner, parseWeightWritePayload } from "../../../../lib/life/weight-service";
import { createWeight, listWeights, WeightCloudError } from "../../../../lib/server/supabase-weight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cloudError(error: WeightCloudError) {
  return lifeJsonError(error.message, error.errorCode === "SERVER_CONFIG" ? 500 : 502, error.errorCode);
}

export async function GET(request: Request) {
  const auth = await requireLifeIdentity(request);
  if (auth.response) return auth.response;
  const person = parseWeightPartner(new URL(request.url).searchParams.get("person"));
  if (!person.ok) return lifeJsonError(person.reason, 400, "BAD_REQUEST");
  try {
    const weights = await listWeights(person.value);
    return NextResponse.json({ ok: true, weights }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof WeightCloudError) return cloudError(error);
    return lifeJsonError("读取体重数据失败", 502, "WEIGHT_READ_FAILED");
  }
}

export async function POST(request: Request) {
  const auth = await requireLifeIdentity(request);
  if (auth.response) return auth.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const raw = typeof body.value === "object" && body.value !== null && !Array.isArray(body.value)
    ? { ...body.value, partnerKey: auth.identity.partnerKey }
    : body.value;
  const parsed = parseWeightWritePayload(raw);
  if (!parsed.ok) return lifeJsonError(parsed.reason, 400, "INVALID_WEIGHT");
  try {
    const weight = await createWeight(parsed.value);
    return NextResponse.json({ ok: true, weight }, { status: 201, headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof WeightCloudError) return cloudError(error);
    return lifeJsonError("保存体重数据失败", 502, "WEIGHT_WRITE_FAILED");
  }
}
