import { NextResponse } from "next/server";
import { clearLifeSessionCookies, setLifeSessionCookies } from "@/lib/server/life-auth-response";
import { resolveLifeAuth } from "@/lib/server/supabase-auth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await resolveLifeAuth(request);
  if (!auth) {
    return clearLifeSessionCookies(
      NextResponse.json({ ok: true, authenticated: false }, { headers: { "Cache-Control": "no-store" } }),
    );
  }
  const response = NextResponse.json(
    { ok: true, authenticated: true, identity: auth.identity },
    { headers: { "Cache-Control": "no-store" } },
  );
  if (auth.refreshedSession) return setLifeSessionCookies(response, auth.refreshedSession);
  return response;
}
