import { NextResponse } from "next/server";
import { isAuthorizedCloudRequest } from "./cloud-request-auth";
import { LifeCloudError } from "./supabase-life";
import { hasCloudSyncConfig } from "./supabase-home-sync";

export function lifeJsonError(message: string, status: number, errorCode: string) {
  return NextResponse.json({ ok: false, error: message, errorCode }, { status });
}

export function lifeCloudErrorResponse(error: LifeCloudError) {
  const status =
    error.errorCode === "SERVER_CONFIG"
      ? 500
      : error.message.toLowerCase().includes("idempotency")
        ? 409
        : 502;
  return lifeJsonError(error.message, status, error.errorCode);
}

export async function authorizeLifeRequest(request: Request) {
  if (!hasCloudSyncConfig()) {
    return lifeJsonError(
      "Supabase 服务端环境变量未配置完整",
      500,
      "SERVER_CONFIG",
    );
  }
  if (!(await isAuthorizedCloudRequest(request))) {
    return lifeJsonError("同步密码不正确或云端会话无效", 401, "UNAUTHORIZED");
  }
  return null;
}

export async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const, response: lifeJsonError("请求格式不正确", 400, "BAD_REQUEST") };
  }
}

export const LIFE_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Couple-Data-Source": "supabase",
};