import { NextResponse } from "next/server";
import { verifyDriveWatchToken } from "@/lib/server/drive-bridge-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

export async function POST(request: Request) {
  if (!verifyDriveWatchToken(request)) {
    return NextResponse.json({ ok: false, error: "invalid watch token" }, { status: 401 });
  }

  const scriptUrl = env("LIFE_DRIVE_APPS_SCRIPT_URL");
  const wakeSecret = env("LIFE_DRIVE_APPS_SCRIPT_WAKE_SECRET");
  if (scriptUrl && wakeSecret) {
    await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "drive-watch", secret: wakeSecret }),
      cache: "no-store",
    }).catch(() => null);
  }

  return new NextResponse(null, { status: 204 });
}
