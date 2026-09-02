import type { LifePartnerKey } from "@/lib/life/life-service";

export const LIFE_ACCESS_COOKIE = "life-access-token";
export const LIFE_REFRESH_COOKIE = "life-refresh-token";

export type LifeAuthIdentity = {
  userId: string;
  email: string | null;
  displayName: string | null;
  coupleSpaceId: string | null;
  partnerKey: LifePartnerKey | null;
  memberRole: "owner" | "member" | null;
};

type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user?: { id?: string; email?: string | null };
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function supabaseUrl() {
  return env("SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL");
}

function publishableKey() {
  return (
    env("SUPABASE_PUBLISHABLE_KEY") ||
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
    env("SUPABASE_ANON_KEY") ||
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}

function serviceKey() {
  return env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
}

function requireAuthConfig() {
  const url = supabaseUrl();
  const key = publishableKey();
  if (!url || !key) throw new Error("SUPABASE_AUTH_CONFIG_MISSING");
  return { url, key };
}

export function hasSupabaseAuthConfig() {
  return Boolean(supabaseUrl() && publishableKey());
}

function readCookie(request: Request, name: string) {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

async function authFetch(path: string, init: RequestInit = {}) {
  const { url, key } = requireAuthConfig();
  return fetch(`${url}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

export async function signUpLifeUser(input: {
  email: string;
  password: string;
  displayName?: string | null;
}) {
  const response = await authFetch("/signup", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      data: { display_name: input.displayName?.trim() || undefined },
    }),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(data.msg ?? data.message ?? "注册失败"));
  return data as unknown as SupabaseSession;
}

export async function signInLifeUser(email: string, password: string) {
  const response = await authFetch("/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(data.error_description ?? data.msg ?? data.message ?? "登录失败"));
  return data as unknown as SupabaseSession;
}

export async function refreshLifeSession(refreshToken: string) {
  const response = await authFetch("/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) return null;
  return (await response.json()) as SupabaseSession;
}

export async function signOutLifeUser(accessToken: string) {
  if (!accessToken) return;
  await authFetch("/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => undefined);
}

async function fetchAuthUser(accessToken: string) {
  if (!accessToken) return null;
  const response = await authFetch("/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  return (await response.json()) as { id?: string; email?: string | null };
}

async function fetchIdentity(accessToken: string) {
  const { url, key } = requireAuthConfig();
  const response = await fetch(`${url}/rest/v1/rpc/current_life_identity`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
  });
  if (!response.ok) return null;
  const raw = (await response.json()) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") return null;
  const partnerKey = raw.partnerKey === "cat" || raw.partnerKey === "fish" ? raw.partnerKey : null;
  const memberRole = raw.memberRole === "owner" || raw.memberRole === "member" ? raw.memberRole : null;
  return {
    userId: typeof raw.userId === "string" ? raw.userId : "",
    displayName: typeof raw.displayName === "string" ? raw.displayName : null,
    coupleSpaceId: typeof raw.coupleSpaceId === "string" ? raw.coupleSpaceId : null,
    partnerKey,
    memberRole,
  };
}

export async function resolveLifeAuth(request: Request): Promise<{
  identity: LifeAuthIdentity;
  accessToken: string;
  refreshedSession: SupabaseSession | null;
} | null> {
  let accessToken = readCookie(request, LIFE_ACCESS_COOKIE);
  const refreshToken = readCookie(request, LIFE_REFRESH_COOKIE);
  let user = await fetchAuthUser(accessToken);
  let refreshedSession: SupabaseSession | null = null;

  if (!user && refreshToken) {
    refreshedSession = await refreshLifeSession(refreshToken);
    if (refreshedSession?.access_token) {
      accessToken = refreshedSession.access_token;
      user = await fetchAuthUser(accessToken);
    }
  }
  if (!user?.id) return null;

  const membership = await fetchIdentity(accessToken);
  return {
    accessToken,
    refreshedSession,
    identity: {
      userId: user.id,
      email: user.email ?? null,
      displayName: membership?.displayName ?? null,
      coupleSpaceId: membership?.coupleSpaceId ?? null,
      partnerKey: membership?.partnerKey ?? null,
      memberRole: membership?.memberRole ?? null,
    },
  };
}

export async function callAuthenticatedRpc<T>(accessToken: string, functionName: string, body: unknown) {
  const { url, key } = requireAuthConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(data.message ?? data.hint ?? "操作失败"));
  return data as unknown as T;
}

export async function bootstrapFirstLifeMember(input: {
  userId: string;
  partnerKey: LifePartnerKey;
}) {
  const url = supabaseUrl();
  const secret = serviceKey();
  if (!url || !secret) throw new Error("SUPABASE_SERVICE_CONFIG_MISSING");

  const existing = await fetch(`${url}/rest/v1/couple_space_members?select=id&limit=1`, {
    headers: { apikey: secret, Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  const existingRows = (await existing.json()) as unknown[];
  if (Array.isArray(existingRows) && existingRows.length > 0) throw new Error("BOOTSTRAP_ALREADY_COMPLETED");

  const spaces = await fetch(`${url}/rest/v1/couple_spaces?slug=eq.couple-better-game&select=id&limit=1`, {
    headers: { apikey: secret, Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  const spaceRows = (await spaces.json()) as Array<{ id?: string }>;
  const spaceId = spaceRows[0]?.id;
  if (!spaceId) throw new Error("COUPLE_SPACE_NOT_FOUND");

  const insert = await fetch(`${url}/rest/v1/couple_space_members`, {
    method: "POST",
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      couple_space_id: spaceId,
      user_id: input.userId,
      partner_key: input.partnerKey,
      member_role: "owner",
    }),
  });
  if (!insert.ok) throw new Error("BOOTSTRAP_INSERT_FAILED");
  return { coupleSpaceId: spaceId, partnerKey: input.partnerKey };
}
