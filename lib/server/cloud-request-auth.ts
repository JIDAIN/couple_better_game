import { timingSafeEqual } from "node:crypto";
import { isValidSyncPassword } from "./supabase-home-sync";

export const CLOUD_SESSION_COOKIE = "couple-cloud-session";

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

async function buildCloudSessionToken() {
  const editPassword = env("DATA_EDIT_PASSWORD");
  const secret = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
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

function safeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export async function isAuthorizedCloudRequest(request: Request) {
  const password = request.headers.get("x-couple-password") ?? "";
  if (isValidSyncPassword(password)) return true;

  const expectedSessionToken = await buildCloudSessionToken();
  const sessionToken = readCookie(request, CLOUD_SESSION_COOKIE);
  if (!expectedSessionToken || !sessionToken) return false;

  return safeEqualText(sessionToken, expectedSessionToken);
}
