import { NextResponse } from "next/server";
import { authorizeLifeRequest, LIFE_NO_STORE_HEADERS, lifeJsonError, readJsonBody } from "../../../../../lib/server/life-api";
import { parseWeightWritePayload } from "../../../../../lib/life/weight-service";
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

export async function PUT(request: Request, context: Context) {
  const auth = await authorizeLifeRequest(request);
  if (auth) return auth;
  const id = await readId(context);
  if (!id) return lifeJsonError("体重记录 ID 格式不正确", 400, "BAD_REQUEST");
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = parseWeightWritePayload(body.value);
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
  const auth = await authorizeLifeRequest(request);
  if (auth) return auth;
  const id = await readId(context);
  if (!id) return lifeJsonError("体重记录 ID 格式不正确", 400, "BAD_REQUEST");
  try {
    const weight = await deleteWeight(id);
    return NextResponse.json({ ok: true, weight }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof WeightCloudError) return cloudError(error);
    return lifeJsonError("删除体重数据失败", 502, "WEIGHT_WRITE_FAILED");
  }
}
