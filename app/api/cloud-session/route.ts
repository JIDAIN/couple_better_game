import { NextResponse } from "next/server";
import {
  hasCloudSyncConfig,
  isValidSyncPassword,
} from "../../../lib/server/supabase-home-sync";

export const runtime = "nodejs";

const CLOUD_SESSION_COOKIE = "couple-cloud-session";
const CLOUD_SESSION_MAX_AGE = 60 * 60 * 24 * 90;

type CloudSessionRequest = {
  password?: unknown;
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

async function buildCloudSessionToken() {
  const editPassword = env("DATA_EDIT_PASSWORD");
  const secret = env("SUPABASE_SECRET_KEY");
  if (!editPassword || !secret) return "";

  const bytes = new TextEncoder().encode(`${editPassword}\u0000${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function jsonError(message: string, status: number, errorCode: string) {
  return NextResponse.json({ ok: false, error: message, errorCode }, { status });
}

export async function POST(request: Request) {
  if (!hasCloudSyncConfig()) {
    return jsonError(
      "Supabase 服务端环境变量未配置完整",
      500,
      "SERVER_CONFIG",
    );
  }

  let body: CloudSessionRequest;
  try {
    body = (await request.json()) as CloudSessionRequest;
  } catch {
    return jsonError("请求格式不正确", 400, "BAD_REQUEST");
  }

  if (!isValidSyncPassword(body.password)) {
    return jsonError("同步密码不正确", 401, "WRONG_PASSWORD");
  }

  const sessionToken = await buildCloudSessionToken();
  if (!sessionToken) {
    return jsonError("云端读取凭证生成失败", 500, "SERVER_CONFIG");
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(CLOUD_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CLOUD_SESSION_MAX_AGE,
  });
  return response;
}
