import { NextResponse } from "next/server";
import {
  LIFE_NO_STORE_HEADERS,
  authorizeLifeRequest,
  lifeJsonError,
  readJsonBody,
} from "@/lib/server/life-api";
import { resolveFixedLifeIdentity } from "@/lib/server/fixed-life-auth";
import {
  LifeWechatReminderError,
  clearLifePushplusToken,
  getLifePushplusStatus,
  setLifePushplusToken,
  testLifePushplus,
} from "@/lib/server/life-wechat-reminders";

function reminderError(error: unknown) {
  const message = error instanceof LifeWechatReminderError ? error.message : "微信提醒服务暂时不可用";
  return lifeJsonError(message, 502, "WECHAT_REMINDER_ERROR");
}

function identityFor(request: Request) {
  return resolveFixedLifeIdentity(request)?.partnerKey ?? null;
}

export async function GET(request: Request) {
  const authError = await authorizeLifeRequest(request);
  if (authError) return authError;
  const actor = identityFor(request);
  if (!actor) return lifeJsonError("请先登录", 401, "UNAUTHORIZED");

  try {
    const status = await getLifePushplusStatus(actor);
    return NextResponse.json({ ok: true, ...status }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    return reminderError(error);
  }
}

export async function PUT(request: Request) {
  const authError = await authorizeLifeRequest(request);
  if (authError) return authError;
  const actor = identityFor(request);
  if (!actor) return lifeJsonError("请先登录", 401, "UNAUTHORIZED");

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const token = typeof parsed.value?.token === "string" ? parsed.value.token.trim() : "";
  if (token.length < 10 || token.length > 256) {
    return lifeJsonError("请输入有效的 PushPlus token", 400, "INVALID_PUSHPLUS_TOKEN");
  }

  try {
    const status = await setLifePushplusToken(actor, token);
    return NextResponse.json({ ok: true, ...status }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    return reminderError(error);
  }
}

export async function POST(request: Request) {
  const authError = await authorizeLifeRequest(request);
  if (authError) return authError;
  const actor = identityFor(request);
  if (!actor) return lifeJsonError("请先登录", 401, "UNAUTHORIZED");

  try {
    const result = await testLifePushplus(actor);
    if (!result.ok) {
      return lifeJsonError(result.error || "PushPlus 测试发送失败", 502, "PUSHPLUS_TEST_FAILED");
    }
    return NextResponse.json({ ok: true, ...result }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    return reminderError(error);
  }
}

export async function DELETE(request: Request) {
  const authError = await authorizeLifeRequest(request);
  if (authError) return authError;
  const actor = identityFor(request);
  if (!actor) return lifeJsonError("请先登录", 401, "UNAUTHORIZED");

  try {
    const status = await clearLifePushplusToken(actor);
    return NextResponse.json({ ok: true, ...status }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    return reminderError(error);
  }
}
