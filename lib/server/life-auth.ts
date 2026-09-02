import { NextResponse } from "next/server";

const DEFAULT_SUPABASE_URL = "https://bfhntnzngozdqsmgfvjk.supabase.co";
export const LIFE_ACCESS_COOKIE = "life_access_token";
export const LIFE_REFRESH_COOKIE = "life_refresh_token";

export type LifePartnerKey = "cat" | "fish";

export type LifeIdentity = {
  userId: string;
  email: string | null;
  displayName: string | null;
  coupleSpaceId: string | null;
  partnerKey: LifePartnerKey | null;
  memberRole: "owner" | "member" | null;
};

type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  token_type?: string;
  user?: { id?: string; email?: string | null };
};

type AuthUser = { id: string; email?: string | null };

type AuthError = { msg?: string; message?: string; error_description?: string; error?: string };

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function supabaseUrl() {
  return env("SUPABASE_URL") || DEFAULT_SUPABASE_URL;
}

function supabaseServerKey() {
  return env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
}

function cookieValue(request: Request, name: string) {
  const source = request.headers.get("cookie") ?? "";
  const match = source.split(/;\s*/).find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

async function parseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as AuthError | null;
  return body?.msg || body?.message || body?.error_description || body?.error || fallback;
}

async function authFetch(path: string, init: RequestInit, bearer?: string) {
  const key = supabaseServerKey();
  if (!key) throw new Error("Supabase 服务端密钥未配置");
  return fetch(`${supabaseUrl()}${path}`, {
    ...init,
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

export async function signInLifeUser(email: string, password: string) {
  const response = await authFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(await parseError(response, "登录失败"));
  return (await response.json()) as AuthSession;
}

export async function signUpLifeUser(email: string, password: string, displayName?: string) {
  const response = await authFetch("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      data: displayName ? { display_name: displayName } : undefined,
    }),
  });
  if (!response.ok) throw new Error(await parseError(response, "注册失败"));
  return (await response.json()) as Partial<AuthSession> & { user?: AuthUser };
}

export async function refreshLifeSession(refreshToken: string) {
  const response = await authFetch("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) throw new Error(await parseError(response, "登录状态已失效"));
  return (await response.json()) as AuthSession;
}

export async function getLifeAuthUser(accessToken: string) {
  const response = await authFetch("/auth/v1/user", { method: "GET" }, accessToken);
  if (!response.ok) return null;
  return (await response.json()) as AuthUser;
}

export async function getLifeIdentity(accessToken: string): Promise<LifeIdentity | null> {
  const user = await getLifeAuthUser(accessToken);
  if (!user) return null;
  const key = supabaseServerKey();
  if (!key) throw new Error("Supabase 服务端密钥未配置");
  const response = await fetch(`${supabaseUrl()}/rest/v1/rpc/current_life_identity`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await parseError(response, "读取账户身份失败"));
  const identity = (await response.json()) as Omit<LifeIdentity, "email"> | null;
  if (!identity) {
    return {
      userId: user.id,
      email: user.email ?? null,
      displayName: null,
      coupleSpaceId: null,
      partnerKey: null,
      memberRole: null,
    };
  }
  return { ...identity, email: user.email ?? null };
}

export async function callLifeAuthRpc<T>(accessToken: string, name: string, body: Record<string, unknown>) {
  const key = supabaseServerKey();
  if (!key) throw new Error("Supabase 服务端密钥未配置");
  const response = await fetch(`${supabaseUrl()}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await parseError(response, "账户操作失败"));
  return (await response.json()) as T;
}

export function readLifeAccessToken(request: Request) {
  return cookieValue(request, LIFE_ACCESS_COOKIE);
}

export function readLifeRefreshToken(request: Request) {
  return cookieValue(request, LIFE_REFRESH_COOKIE);
}

export function setLifeAuthCookies(response: NextResponse, session: Pick<AuthSession, "access_token" | "refresh_token" | "expires_in">) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(LIFE_ACCESS_COOKIE, session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: Math.max(60, session.expires_in ?? 3600),
  });
  response.cookies.set(LIFE_REFRESH_COOKIE, session.refresh_token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearLifeAuthCookies(response: NextResponse) {
  response.cookies.set(LIFE_ACCESS_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  response.cookies.set(LIFE_REFRESH_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

export async function resolveLifeIdentity(request: Request) {
  const accessToken = readLifeAccessToken(request);
  if (!accessToken) return null;
  return getLifeIdentity(accessToken);
}
