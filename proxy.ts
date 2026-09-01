import { NextRequest, NextResponse } from "next/server";

const CLOUD_SESSION_COOKIE = "couple-cloud-session";

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

async function buildCloudSessionToken() {
  const editPassword = env("DATA_EDIT_PASSWORD");
  const secret = env("SUPABASE_SECRET_KEY");
  if (!editPassword || !secret) return "";

  const bytes = new TextEncoder().encode(`${editPassword}\u0000${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function proxy(request: NextRequest) {
  const sessionToken = request.cookies.get(CLOUD_SESSION_COOKIE)?.value ?? "";
  const expectedSessionToken = await buildCloudSessionToken();

  if (!sessionToken || !expectedSessionToken) {
    return NextResponse.next();
  }

  if (sessionToken !== expectedSessionToken) {
    const response = NextResponse.next();
    response.cookies.delete(CLOUD_SESSION_COOKIE);
    return response;
  }

  const url = request.nextUrl.clone();
  url.pathname = "/api/home-data";
  url.search = "";

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/data/couple-data.json"],
};
