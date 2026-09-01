import { NextResponse } from "next/server";
import { buildHomeSyncData } from "../../../lib/home/export-service";
import { importHomeBackupJson } from "../../../lib/home/import-service";
import {
  CloudSyncError,
  hasCloudSyncConfig,
  isValidSyncPassword,
  saveHomeSyncSnapshot,
} from "../../../lib/server/supabase-home-sync";

export const runtime = "nodejs";

const CLOUD_SESSION_COOKIE = "couple-cloud-session";
const CLOUD_SESSION_MAX_AGE = 60 * 60 * 24 * 90;

type SaveDataRequest = {
  password?: unknown;
  data?: unknown;
};

type SaveDataErrorCode =
  | "SERVER_CONFIG"
  | "BAD_REQUEST"
  | "WRONG_PASSWORD"
  | "INVALID_DATA"
  | "CLOUD_SESSION_REQUIRED"
  | "CLOUD_READ_FAILED"
  | "CLOUD_WRITE_FAILED"
  | "CLOUD_NETWORK_ERROR";

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

function jsonError(
  message: string,
  status: number,
  errorCode: SaveDataErrorCode,
) {
  return NextResponse.json({ ok: false, error: message, errorCode }, { status });
}

function setCloudSessionCookie(response: NextResponse, sessionToken: string) {
  response.cookies.set(CLOUD_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CLOUD_SESSION_MAX_AGE,
  });
}

export async function POST(request: Request) {
  const editPassword = env("DATA_EDIT_PASSWORD");
  if (!editPassword) {
    return jsonError("同步密码环境变量未配置", 500, "SERVER_CONFIG");
  }

  if (!hasCloudSyncConfig()) {
    return jsonError(
      "Supabase 服务端环境变量未配置完整",
      500,
      "SERVER_CONFIG",
    );
  }

  let body: SaveDataRequest;
  try {
    body = (await request.json()) as SaveDataRequest;
  } catch {
    return jsonError("请求格式不正确", 400, "BAD_REQUEST");
  }

  if (!isValidSyncPassword(body.password)) {
    return jsonError("同步密码不正确", 401, "WRONG_PASSWORD");
  }

  const expectedSessionToken = await buildCloudSessionToken();
  if (!expectedSessionToken) {
    return jsonError("云端读取凭证生成失败", 500, "SERVER_CONFIG");
  }

  const currentSessionToken = readCookie(request, CLOUD_SESSION_COOKIE);
  if (currentSessionToken !== expectedSessionToken) {
    const response = jsonError(
      "首次连接请先从云端重新加载；已为本设备建立云端读取凭证，本次没有上传本地数据",
      409,
      "CLOUD_SESSION_REQUIRED",
    );
    setCloudSessionCookie(response, expectedSessionToken);
    return response;
  }

  const imported = importHomeBackupJson(JSON.stringify(body.data));
  if (!imported.ok) {
    return jsonError(
      imported.reason ?? "同步数据格式不正确",
      400,
      "INVALID_DATA",
    );
  }

  const updatedAt = new Date().toISOString();
  const canonicalData = buildHomeSyncData(imported.state, updatedAt);

  try {
    await saveHomeSyncSnapshot(canonicalData);
    const response = NextResponse.json({ ok: true, updatedAt });
    setCloudSessionCookie(response, expectedSessionToken);
    return response;
  } catch (error) {
    if (error instanceof CloudSyncError) {
      return jsonError(error.message, 502, error.errorCode);
    }
    return jsonError("同步到云端失败", 502, "CLOUD_NETWORK_ERROR");
  }
}
