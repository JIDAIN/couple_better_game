import { NextResponse } from "next/server";
import { parseActivityWritePayload } from "../../../../lib/life/life-service";
import {
  authorizeLifeRequest,
  LIFE_NO_STORE_HEADERS,
  lifeCloudErrorResponse,
  lifeJsonError,
  readJsonBody,
} from "../../../../lib/server/life-api";
import { resolveFixedLifeIdentity } from "../../../../lib/server/fixed-life-auth";
import { createActivity, LifeCloudError } from "../../../../lib/server/supabase-life";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authError = await authorizeLifeRequest(request);
  if (authError) return authError;
  const identity = resolveFixedLifeIdentity(request);
  if (!identity) return lifeJsonError("请先登录", 401, "UNAUTHORIZED");

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
    return lifeJsonError("只能新增自己的活动或双方共同活动", 403, "OWN_RECORD_ONLY");
  }

  try {
    const activity = await createActivity(parsed.value, identity.partnerKey);
    return NextResponse.json(
      { ok: true, activity },
      { status: 201, headers: LIFE_NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof LifeCloudError) {
      if (error.message.includes("OWN_RECORD_ONLY")) {
        return lifeJsonError("只能新增自己的活动或双方共同活动", 403, "OWN_RECORD_ONLY");
      }
      return lifeCloudErrorResponse(error);
    }
    return lifeJsonError("写入活动记录失败", 502, "LIFE_WRITE_FAILED");
  }
}
