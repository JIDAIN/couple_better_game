import { NextResponse } from "next/server";
import {
  CloudSyncError,
  hasCloudSyncConfig,
  isValidSyncPassword,
  loadHomeSyncSnapshot,
} from "../../../lib/server/supabase-home-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLOUD_SESSION_COOKIE = "couple-cloud-session";

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

function readCookie(request: Request, name: string) {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function jsonError(message: string, status: number, errorCode: string) {
  return NextResponse.json({ ok: false, error: message, errorCode }, { status });
}

export async function GET(request: Request) {
  if (!hasCloudSyncConfig()) {
    return jsonError(
      "Supabase 服务端环境变量未配置完整",
      500,
      "SERVER_CONFIG",
    );
  }

  const password = request.headers.get("x-couple-password") ?? "";
  const sessionToken = readCookie(request, CLOUD_SESSION_COOKIE);
  const expectedSessionToken = await buildCloudSessionToken();
  const hasValidSession =
    Boolean(sessionToken) &&
    Boolean(expectedSessionToken) &&
    sessionToken === expectedSessionToken;

  if (!hasValidSession && !isValidSyncPassword(password)) {
    return jsonError("同步密码不正确", 401, "WRONG_PASSWORD");
  }

  try {
    const data = await loadHomeSyncSnapshot();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Couple-Data-Source": "supabase",
      },
    });
  } catch (error) {
    if (error instanceof CloudSyncError) {
      return jsonError(error.message, 502, error.errorCode);
    }
    return jsonError("读取云端数据失败", 502, "CLOUD_READ_FAILED");
  }
}
