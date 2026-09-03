import { NextResponse } from "next/server";
import {
  driveBridgeAppsScriptUrl,
  driveBridgeAppsScriptWakeSecret,
  verifyDriveWatchToken,
} from "@/lib/server/drive-bridge-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const watch = verifyDriveWatchToken(request);
  if (!watch.ok) {
    return NextResponse.json({ ok: false, error: "invalid watch token" }, { status: 401 });
  }

  const scriptUrl = driveBridgeAppsScriptUrl(watch.bridgeId);
  const wakeSecret = driveBridgeAppsScriptWakeSecret(watch.bridgeId);
  if (scriptUrl && wakeSecret) {
    await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "drive-watch", bridgeId: watch.bridgeId, secret: wakeSecret }),
      cache: "no-store",
    }).catch(() => null);
  }

  return new NextResponse(null, { status: 204 });
}
