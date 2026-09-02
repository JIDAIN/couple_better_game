import { NextResponse } from "next/server";
import { LIFE_ACCOUNT_COOKIE } from "@/lib/server/fixed-life-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(LIFE_ACCOUNT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
