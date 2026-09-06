import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { LifePartnerKey } from "@/lib/life/life-service";

const DEFAULT_SUPABASE_URL = "https://bfhntnzngozdqsmgfvjk.supabase.co";
const ACCESS_TOKEN_SECONDS = 60 * 60;
const REFRESH_TOKEN_SECONDS = 60 * 60 * 24 * 30;
const AUTH_CODE_SECONDS = 5 * 60;
const CLIENT_ID_SECONDS = 60 * 60 * 24 * 365 * 5;

export const LIFE_MCP_SCOPES = ["life:read", "life:write", "offline_access"] as const;
export type LifeMcpScope = (typeof LIFE_MCP_SCOPES)[number];

type SignedKind = "client" | "code" | "access" | "refresh";

type SignedBase = {
  kind: SignedKind;
  iat: number;
  exp: number;
};

type ClientPayload = SignedBase & {
  kind: "client";
  redirectUris: string[];
  clientName: string | null;
};

type AuthorizationCodePayload = SignedBase & {
  kind: "code";
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  partnerKey: LifePartnerKey;
  resource: string;
  scope: LifeMcpScope[];
};

type AccessTokenPayload = SignedBase & {
  kind: "access";
  partnerKey: LifePartnerKey;
  aud: string;
  scope: LifeMcpScope[];
};

type RefreshTokenPayload = SignedBase & {
  kind: "refresh";
  partnerKey: LifePartnerKey;
  aud: string;
  scope: LifeMcpScope[];
};

export type LifeMcpAccessIdentity = {
  partnerKey: LifePartnerKey;
  scopes: LifeMcpScope[];
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function signingSecret() {
  const secret = env("LIFE_MCP_SIGNING_SECRET");
  if (secret.length < 32) throw new Error("LIFE_MCP_SIGNING_SECRET_MISSING");
  return secret;
}

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeJson(value: string): unknown {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function signature(encoded: string) {
  return createHmac("sha256", signingSecret()).update(encoded).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function signPayload<T extends SignedBase>(payload: T) {
  const encoded = encodeJson(payload);
  return `${encoded}.${signature(encoded)}`;
}

function verifyPayload<T extends SignedBase>(token: string, kind: T["kind"]): T | null {
  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra) return null;
  let expectedSignature: string;
  try {
    expectedSignature = signature(encoded);
  } catch {
    return null;
  }
  if (!safeEqual(suppliedSignature, expectedSignature)) return null;
  try {
    const payload = decodeJson(encoded) as Partial<T>;
    if (payload.kind !== kind) return null;
    if (typeof payload.iat !== "number" || typeof payload.exp !== "number") return null;
    if (payload.exp <= nowSeconds()) return null;
    return payload as T;
  } catch {
    return null;
  }
}

function isIpv4Loopback(hostname: string) {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts[0] !== "127") return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function isLoopbackHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "::1" || normalized === "[::1]" || isIpv4Loopback(normalized);
}

function isPrivateUseRedirect(url: URL) {
  if (url.protocol === "http:" || url.protocol === "https:") return false;
  if (["file:", "data:", "javascript:", "ftp:", "ws:", "wss:"].includes(url.protocol)) return false;
  if (url.username || url.password) return false;
  return /^[a-z][a-z0-9+.-]*:$/.test(url.protocol);
}

function validOAuthRedirectUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    if (url.protocol === "http:") return isLoopbackHostname(url.hostname);
    return isPrivateUseRedirect(url);
  } catch {
    return false;
  }
}

export function normalizeScopes(value: string | null | undefined): LifeMcpScope[] {
  const requested = (value ?? "")
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  const scopes = LIFE_MCP_SCOPES.filter((scope) => requested.includes(scope));
  return scopes.length > 0 ? [...scopes] : ["life:read", "life:write", "offline_access"];
}

export function createRegisteredClient(input: {
  redirectUris: string[];
  clientName?: string | null;
}) {
  const redirectUris = [...new Set(input.redirectUris.map((value) => value.trim()))].filter(validOAuthRedirectUrl);
  if (redirectUris.length === 0 || redirectUris.length > 10) throw new Error("INVALID_REDIRECT_URIS");
  const now = nowSeconds();
  const payload: ClientPayload = {
    kind: "client",
    iat: now,
    exp: now + CLIENT_ID_SECONDS,
    redirectUris,
    clientName: input.clientName?.trim().slice(0, 120) || null,
  };
  return signPayload(payload);
}

export function resolveRegisteredClient(clientId: string) {
  return verifyPayload<ClientPayload>(clientId, "client");
}

export function createAuthorizationCode(input: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  partnerKey: LifePartnerKey;
  resource: string;
  scope: LifeMcpScope[];
}) {
  const now = nowSeconds();
  return signPayload<AuthorizationCodePayload>({
    kind: "code",
    iat: now,
    exp: now + AUTH_CODE_SECONDS,
    ...input,
  });
}

export function resolveAuthorizationCode(code: string) {
  return verifyPayload<AuthorizationCodePayload>(code, "code");
}

export function verifyPkce(codeVerifier: string, codeChallenge: string) {
  if (codeVerifier.length < 43 || codeVerifier.length > 128) return false;
  const calculated = createHash("sha256").update(codeVerifier).digest("base64url");
  return safeEqual(calculated, codeChallenge);
}

export function issueMcpTokens(input: {
  partnerKey: LifePartnerKey;
  resource: string;
  scope: LifeMcpScope[];
}) {
  const now = nowSeconds();
  const accessToken = signPayload<AccessTokenPayload>({
    kind: "access",
    iat: now,
    exp: now + ACCESS_TOKEN_SECONDS,
    partnerKey: input.partnerKey,
    aud: input.resource,
    scope: input.scope,
  });
  const refreshToken = signPayload<RefreshTokenPayload>({
    kind: "refresh",
    iat: now,
    exp: now + REFRESH_TOKEN_SECONDS,
    partnerKey: input.partnerKey,
    aud: input.resource,
    scope: input.scope,
  });
  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_SECONDS };
}

export function resolveRefreshToken(token: string, resource: string) {
  const payload = verifyPayload<RefreshTokenPayload>(token, "refresh");
  if (!payload || payload.aud !== resource) return null;
  return payload;
}

export function resolveAccessToken(request: Request, resource: string): LifeMcpAccessIdentity | null {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) return null;
  const payload = verifyPayload<AccessTokenPayload>(match[1], "access");
  if (!payload || payload.aud !== resource) return null;
  if (payload.partnerKey !== "cat" && payload.partnerKey !== "fish") return null;
  const scopes = payload.scope.filter((scope): scope is LifeMcpScope => LIFE_MCP_SCOPES.includes(scope));
  return { partnerKey: payload.partnerKey, scopes };
}

function supabaseConfig() {
  const url = env("SUPABASE_URL") || DEFAULT_SUPABASE_URL;
  const secret = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  return { url, secret };
}

export async function markAuthorizationCodeRedeemed(code: string) {
  const { url, secret } = supabaseConfig();
  const codeHash = createHash("sha256").update(code).digest("hex");
  const response = await fetch(`${url}/rest/v1/life_mcp_code_redemptions`, {
    method: "POST",
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ code_hash: codeHash }),
    cache: "no-store",
  });
  if (response.status === 409) return false;
  if (!response.ok) throw new Error("MCP_CODE_REDEMPTION_FAILED");
  return true;
}
