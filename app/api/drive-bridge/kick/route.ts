import { NextResponse } from "next/server";
import { parseDriveBridgeId } from "@/lib/server/drive-bridge-auth";
import {
  googleWebAppHop,
  parseAllowedGoogleWebAppRedirect,
} from "@/lib/server/drive-bridge-google-webapp";
import {
  isDriveProjectKickCommandId,
  verifyDriveProjectKickToken,
} from "@/lib/server/drive-bridge-project-kick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function isRedirect(status: number) {
  return status >= 300 && status < 400;
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
    const firstResponse = await fetch(scriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "CoupleBetterGame-HarborWake/1.0",
      },
      body: JSON.stringify({
        type: "project-kick",
        bridgeId,
        commandId,
        secret: wakeSecret,
      }),
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });

    const firstHop = googleWebAppHop(firstResponse);
    let workerResponse = firstResponse;

    if (isRedirect(firstResponse.status)) {
      const redirectUrl = parseAllowedGoogleWebAppRedirect(
        firstResponse.headers.get("location"),
        scriptUrl,
      );
      if (!redirectUrl) {
        console.warn("[harbor-kick] rejected Google redirect", {
          bridgeId,
          commandId,
          firstHop,
        });
        return json(
          {
            ok: false,
            error: "worker redirect rejected",
            bridgeId,
            commandId,
            diagnostics: { firstHop },
          },
          502,
        );
      }

      workerResponse = await fetch(redirectUrl, {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "CoupleBetterGame-HarborWake/1.0" },
      });
    }

    const finalHop = googleWebAppHop(workerResponse);
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

    if (!workerResponse.ok || worker.ok === false || worker.ok !== true) {
      console.warn("[harbor-kick] Apps Script wake failed", {
        bridgeId,
        commandId,
        firstHop,
        finalHop,
        bodyKind: text.trim().startsWith("{") ? "json-like" : text.trim().startsWith("<") ? "html-like" : "other",
      });
      return json(
        {
          ok: false,
          error: "worker wake failed",
          bridgeId,
          commandId,
          diagnostics: { firstHop, finalHop },
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
      diagnostics: { firstHop, finalHop },
    });
  } catch (error) {
    console.warn("[harbor-kick] wake unavailable", {
      bridgeId,
      commandId,
      error: error instanceof Error ? error.name : "unknown",
    });
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
