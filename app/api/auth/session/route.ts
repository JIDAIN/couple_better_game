import { NextResponse } from "next/server";
import { LIFE_ACCOUNT_COOKIE, resolveFixedLifeIdentity } from "@/lib/server/fixed-life-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = resolveFixedLifeIdentity(request);
  const response = NextResponse.json(
    identity
      ? { ok: true, authenticated: true, identity }
      : { ok: true, authenticated: false },
    { headers: { "Cache-Control": "no-store" } },
  );
  if (!identity) {
    response.cookies.set(LIFE_ACCOUNT_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}
