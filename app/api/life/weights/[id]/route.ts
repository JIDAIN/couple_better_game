import { NextResponse } from "next/server";
import { LIFE_NO_STORE_HEADERS, lifeJsonError, readJsonBody, requireLifeIdentity } from "../../../../../lib/server/life-api";
import { parseWeightWritePayload } from "../../../../../lib/life/weight-service";
import { weightOwnerKey } from "../../../../../lib/server/life-record-owner";
import { deleteWeight, updateWeight, WeightCloudError } from "../../../../../lib/server/supabase-weight";
import { isUuid } from "../../../../../lib/nutrition/meal-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

function cloudError(error: WeightCloudError) {
  const status = error.errorCode === "SERVER_CONFIG" ? 500 : error.message.includes("not found") ? 404 : 502;
  return lifeJsonError(error.message, status, error.errorCode);
}

async function readId(context: Context) {
  const { id } = await context.params;
  return isUuid(id) ? id : null;
}

async function authorizeWeightOwner(request: Request, id: string) {
  const auth = await requireLifeIdentity(request);
  if (auth.response) return { identity: null, response: auth.response };
  const owner = await weightOwnerKey(id);
  if (!owner) return { identity: null, response: lifeJsonError("体重记录不存在", 404, "NOT_FOUND") };
  if (owner !== auth.identity.partnerKey) {
    return { identity: null, response: lifeJsonError("只能修改自己的体重记录", 403, "FORBIDDEN") };
  }
  return { identity: auth.identity, response: null };
}

export async function PUT(request: Request, context: Context) {
  const id = await readId(context);
  if (!id) return lifeJsonError("体重记录 ID 格式不正确", 400, "BAD_REQUEST");
  const auth = await authorizeWeightOwner(request, id);
  if (auth.response) return auth.response;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const raw = typeof body.value === "object" && body.value !== null && !Array.isArray(body.value)
    ? { ...body.value, partnerKey: auth.identity!.partnerKey }
    : body.value;
  const parsed = parseWeightWritePayload(raw);
  if (!parsed.ok) return lifeJsonError(parsed.reason, 400, "INVALID_WEIGHT");
  try {
    const weight = await updateWeight(id, parsed.value);
    return NextResponse.json({ ok: true, weight }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof WeightCloudError) return cloudError(error);
    return lifeJsonError("更新体重数据失败", 502, "WEIGHT_WRITE_FAILED");
  }
}

export async function DELETE(request: Request, context: Context) {
  const id = await readId(context);
  if (!id) return lifeJsonError("体重记录 ID 格式不正确", 400, "BAD_REQUEST");
  const auth = await authorizeWeightOwner(request, id);
  if (auth.response) return auth.response;
  try {
    const weight = await deleteWeight(id);
    return NextResponse.json({ ok: true, weight }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof WeightCloudError) return cloudError(error);
    return lifeJsonError("删除体重数据失败", 502, "WEIGHT_WRITE_FAILED");
  }
}
