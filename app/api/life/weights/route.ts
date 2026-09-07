import { NextResponse } from "next/server";
import { authorizeLifeRequest, authorizePersonalPartnerWrite, LIFE_NO_STORE_HEADERS, lifeJsonError, readJsonBody } from "../../../../lib/server/life-api";
import { parseWeightPartner, parseWeightWritePayload } from "../../../../lib/life/weight-service";
import { createWeight, listWeights, WeightCloudError } from "../../../../lib/server/supabase-weight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cloudError(error: WeightCloudError) {
  const status = error.errorCode === "SERVER_CONFIG" ? 500 : error.message.includes("OWN_RECORD_ONLY") ? 403 : 502;
  return lifeJsonError(
    error.message.includes("OWN_RECORD_ONLY") ? "只能保存自己的体重记录" : error.message,
    status,
    error.message.includes("OWN_RECORD_ONLY") ? "OWN_RECORD_ONLY" : error.errorCode,
  );
}

export async function GET(request: Request) {
  const auth = await authorizeLifeRequest(request);
  if (auth) return auth;
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
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = parseWeightWritePayload(body.value);
  if (!parsed.ok) return lifeJsonError(parsed.reason, 400, "INVALID_WEIGHT");
  const auth = await authorizePersonalPartnerWrite(request, parsed.value.partnerKey);
  if (auth) return auth;
  try {
    const weight = await createWeight(parsed.value, parsed.value.partnerKey);
    return NextResponse.json({ ok: true, weight }, { status: 201, headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof WeightCloudError) return cloudError(error);
    return lifeJsonError("保存体重数据失败", 502, "WEIGHT_WRITE_FAILED");
  }
}
