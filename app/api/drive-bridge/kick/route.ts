import { NextResponse } from "next/server";
import { parseDriveBridgeId } from "@/lib/server/drive-bridge-auth";
import {
  isDriveProjectKickCommandId,
  verifyDriveProjectKickToken,
} from "@/lib/server/drive-bridge-project-kick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
} as const;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bridgeId = parseDriveBridgeId(url.searchParams.get("bridgeId")?.trim() ?? "");
  const commandId = url.searchParams.get("commandId")?.trim() ?? "";
  const token = url.searchParams.get("token")?.trim() ?? "";

  if (!bridgeId || !isDriveProjectKickCommandId(commandId)) {
    return json({ ok: false, error: "invalid request" }, 400);
  }

  const auth = await verifyDriveProjectKickToken(bridgeId, token);
  if (!auth.ok) {
    return json({ ok: false, error: "invalid kick token" }, 401);
  }

  const scriptUrl = auth.config.appsScriptUrl;
  const wakeSecret = auth.config.appsScriptWakeSecret;
  if (!scriptUrl || !wakeSecret) {
    return json({ ok: false, error: "worker not configured" }, 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const workerResponse = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "project-kick",
        bridgeId,
        commandId,
        secret: wakeSecret,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await workerResponse.text();
    let worker: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(text || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        worker = parsed as Record<string, unknown>;
      }
    } catch {
      worker = {};
    }

    if (!workerResponse.ok || worker.ok === false) {
      return json(
        {
          ok: false,
          error: "worker wake failed",
          bridgeId,
          commandId,
        },
        502,
      );
    }

    return json({
      ok: true,
      bridgeId,
      commandId,
      processed: typeof worker.processed === "number" ? worker.processed : null,
      skipped: typeof worker.skipped === "string" ? worker.skipped : null,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error && error.name === "AbortError" ? "worker wake timeout" : "worker wake unavailable",
        bridgeId,
        commandId,
      },
      504,
    );
  } finally {
    clearTimeout(timeout);
  }
}
