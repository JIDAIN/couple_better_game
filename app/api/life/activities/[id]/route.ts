import { NextResponse } from "next/server";
import { parseActivityWritePayload } from "../../../../../lib/life/life-service";
import {
  authorizeLifeRequest,
  LIFE_NO_STORE_HEADERS,
  lifeCloudErrorResponse,
  lifeJsonError,
  readJsonBody,
} from "../../../../../lib/server/life-api";
import { resolveFixedLifeIdentity } from "../../../../../lib/server/fixed-life-auth";
import {
  deleteActivity,
  LifeCloudError,
  updateActivity,
} from "../../../../../lib/server/supabase-life";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function readActivityId(context: RouteContext) {
  const { id } = await context.params;
  return isUuid(id) ? id : null;
}

function activityCloudError(error: LifeCloudError) {
  if (error.message.includes("OWN_RECORD_ONLY")) {
    return lifeJsonError("只能修改自己的活动或双方共同活动", 403, "OWN_RECORD_ONLY");
  }
  if (error.message.includes("SHARED_ACTIVITY_SCOPE_LOCKED")) {
    return lifeJsonError("双方共同活动不能直接改成单方活动", 403, "SHARED_ACTIVITY_SCOPE_LOCKED");
  }
  if (error.message.includes("Activity not found")) {
    return lifeJsonError(error.message, 404, "ACTIVITY_NOT_FOUND");
  }
  return lifeCloudErrorResponse(error);
}

export async function PUT(request: Request, context: RouteContext) {
  const authError = await authorizeLifeRequest(request);
  if (authError) return authError;
  const identity = resolveFixedLifeIdentity(request);
  if (!identity) return lifeJsonError("请先登录", 401, "UNAUTHORIZED");

  const activityId = await readActivityId(context);
  if (!activityId) {
    return lifeJsonError("活动 ID 格式不正确", 400, "BAD_REQUEST");
  }

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
  if (parsed.value.participantScope !== identity.partnerKey && parsed.value.participantScope !== "both") {
    return lifeJsonError("不能把活动改到 Ta 名下", 403, "OWN_RECORD_ONLY");
  }

  try {
    const activity = await updateActivity(activityId, parsed.value, identity.partnerKey);
    return NextResponse.json(
      { ok: true, activity },
      { headers: LIFE_NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof LifeCloudError) return activityCloudError(error);
    return lifeJsonError("更新活动记录失败", 502, "LIFE_WRITE_FAILED");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authError = await authorizeLifeRequest(request);
  if (authError) return authError;
  const identity = resolveFixedLifeIdentity(request);
  if (!identity) return lifeJsonError("请先登录", 401, "UNAUTHORIZED");

  const activityId = await readActivityId(context);
  if (!activityId) {
    return lifeJsonError("活动 ID 格式不正确", 400, "BAD_REQUEST");
  }

  try {
    const activity = await deleteActivity(activityId, identity.partnerKey);
    return NextResponse.json(
      { ok: true, activity },
      { headers: LIFE_NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof LifeCloudError) return activityCloudError(error);
    return lifeJsonError("删除活动记录失败", 502, "LIFE_WRITE_FAILED");
  }
}
