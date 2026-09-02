import { createHmac, timingSafeEqual } from "node:crypto";
import type { LifePartnerKey } from "@/lib/life/life-service";
import { isValidSyncPassword } from "./supabase-home-sync";

export const LIFE_ACCOUNT_COOKIE = "life-account-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = {
  partnerKey: LifePartnerKey;
  expiresAt: number;
};

export type FixedLifeIdentity = {
  partnerKey: LifePartnerKey;
  displayName: "我" | "Ta";
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function signingSecret() {
  const password = env("DATA_EDIT_PASSWORD");
  const serverSecret = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  return password && serverSecret ? `${password}\u0000${serverSecret}\u0000life-account-v1` : "";
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(payload: string) {
  const secret = signingSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function readCookie(request: Request, name: string) {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export function authenticateFixedLifeAccount(partnerKey: unknown, password: unknown) {
  if (partnerKey !== "cat" && partnerKey !== "fish") return null;
  if (typeof password !== "string" || !isValidSyncPassword(password)) return null;
  return partnerKey as LifePartnerKey;
}

export function createFixedLifeSession(partnerKey: LifePartnerKey) {
  const payload: SessionPayload = {
    partnerKey,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const encoded = encode(JSON.stringify(payload));
  const sig = signature(encoded);
  if (!sig) throw new Error("LIFE_ACCOUNT_CONFIG_MISSING");
  return { token: `${encoded}.${sig}`, maxAge: SESSION_MAX_AGE_SECONDS };
}

export function resolveFixedLifeIdentity(request: Request): FixedLifeIdentity | null {
  const token = readCookie(request, LIFE_ACCOUNT_COOKIE);
  const [encoded, suppliedSig] = token.split(".");
  if (!encoded || !suppliedSig) return null;
  const expectedSig = signature(encoded);
  if (!expectedSig || !safeEqual(suppliedSig, expectedSig)) return null;
  try {
    const payload = JSON.parse(decode(encoded)) as Partial<SessionPayload>;
    if (payload.partnerKey !== "cat" && payload.partnerKey !== "fish") return null;
    if (typeof payload.expiresAt !== "number" || payload.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return {
      partnerKey: payload.partnerKey,
      displayName: payload.partnerKey === "cat" ? "我" : "Ta",
    };
  } catch {
    return null;
  }
}
