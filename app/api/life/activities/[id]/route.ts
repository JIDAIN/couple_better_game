import { NextResponse } from "next/server";
import { parseActivityWritePayload } from "../../../../../lib/life/life-service";
import {
  authorizeLifeRequest,
  LIFE_NO_STORE_HEADERS,
  lifeCloudErrorResponse,
  lifeJsonError,
  readJsonBody,
} from "../../../../../lib/server/life-api";
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

export async function PUT(request: Request, context: RouteContext) {
  const authError = await authorizeLifeRequest(request);
  if (authError) return authError;

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

  try {
    const activity = await updateActivity(activityId, parsed.value);
    return NextResponse.json(
      { ok: true, activity },
      { headers: LIFE_NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof LifeCloudError) {
      if (error.message.includes("Activity not found")) {
        return lifeJsonError(error.message, 404, "ACTIVITY_NOT_FOUND");
      }
      return lifeCloudErrorResponse(error);
    }
    return lifeJsonError("更新活动记录失败", 502, "LIFE_WRITE_FAILED");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authError = await authorizeLifeRequest(request);
  if (authError) return authError;

  const activityId = await readActivityId(context);
  if (!activityId) {
    return lifeJsonError("活动 ID 格式不正确", 400, "BAD_REQUEST");
  }

  try {
    const activity = await deleteActivity(activityId);
    return NextResponse.json(
      { ok: true, activity },
      { headers: LIFE_NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof LifeCloudError) {
      if (error.message.includes("Activity not found")) {
        return lifeJsonError(error.message, 404, "ACTIVITY_NOT_FOUND");
      }
      return lifeCloudErrorResponse(error);
    }
    return lifeJsonError("删除活动记录失败", 502, "LIFE_WRITE_FAILED");
  }
}
