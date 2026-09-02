import { NextResponse } from "next/server";
import { clearLifeSessionCookies } from "@/lib/server/life-auth-response";
import { LIFE_ACCESS_COOKIE, signOutLifeUser } from "@/lib/server/supabase-auth-http";

function readCookie(request: Request, name: string) {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export async function POST(request: Request) {
  await signOutLifeUser(readCookie(request, LIFE_ACCESS_COOKIE));
  return clearLifeSessionCookies(NextResponse.json({ ok: true }));
}
