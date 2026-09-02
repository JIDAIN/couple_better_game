import { NextResponse } from "next/server";
import { LIFE_ACCESS_COOKIE, LIFE_REFRESH_COOKIE } from "./supabase-auth-http";

const baseCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function setLifeSessionCookies(
  response: NextResponse,
  session: { access_token: string; refresh_token: string; expires_in?: number },
) {
  response.cookies.set(LIFE_ACCESS_COOKIE, session.access_token, {
    ...baseCookie,
    maxAge: Math.max(60, Number(session.expires_in ?? 3600)),
  });
  response.cookies.set(LIFE_REFRESH_COOKIE, session.refresh_token, {
    ...baseCookie,
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export function clearLifeSessionCookies(response: NextResponse) {
  response.cookies.set(LIFE_ACCESS_COOKIE, "", { ...baseCookie, maxAge: 0 });
  response.cookies.set(LIFE_REFRESH_COOKIE, "", { ...baseCookie, maxAge: 0 });
  return response;
}
