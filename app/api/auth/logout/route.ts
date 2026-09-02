import { NextResponse } from "next/server";
import { clearLifeAuthCookies } from "@/lib/server/life-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearLifeAuthCookies(response);
  return response;
}
