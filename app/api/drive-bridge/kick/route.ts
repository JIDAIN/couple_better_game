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

type WakeAttempt = {
  workerResponse: Response;
  worker: Record<string, unknown>;
  firstHop: ReturnType<typeof googleWebAppHop>;
  finalHop: ReturnType<typeof googleWebAppHop>;
  bodyKind: "json-like" | "html-like" | "other";
};

async function invokeWorker(options: {
  scriptUrl: string;
  wakeSecret: string;
  bridgeId: "cat" | "fish";
  commandId: string;
  signal: AbortSignal;
}): Promise<WakeAttempt> {
  const { scriptUrl, wakeSecret, bridgeId, commandId, signal } = options;
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
    signal,
  });

  const firstHop = googleWebAppHop(firstResponse);
  let workerResponse = firstResponse;

  if (isRedirect(firstResponse.status)) {
    const redirectUrl = parseAllowedGoogleWebAppRedirect(
      firstResponse.headers.get("location"),
      scriptUrl,
    );
    if (!redirectUrl) {
      throw Object.assign(new Error("WORKER_REDIRECT_REJECTED"), { firstHop });
    }

    workerResponse = await fetch(redirectUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal,
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

  return {
    workerResponse,
    worker,
    firstHop,
    finalHop,
    bodyKind: text.trim().startsWith("{")
      ? "json-like"
      : text.trim().startsWith("<")
        ? "html-like"
        : "other",
  };
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
    const firstAttempt = await invokeWorker({
      scriptUrl,
      wakeSecret,
      bridgeId,
      commandId,
      signal: controller.signal,
    });

    if (!firstAttempt.workerResponse.ok) {
      console.warn("[harbor-kick] Apps Script HTTP wake failed", {
        bridgeId,
        commandId,
        firstHop: firstAttempt.firstHop,
        finalHop: firstAttempt.finalHop,
        bodyKind: firstAttempt.bodyKind,
      });
      return json(
        {
          ok: false,
          error: "worker wake failed",
          bridgeId,
          commandId,
          diagnostics: {
            firstHop: firstAttempt.firstHop,
            finalHop: firstAttempt.finalHop,
          },
        },
        502,
      );
    }

    let finalAttempt = firstAttempt;
    let retried = false;

    // The worker can finish COMMANDS/RECEIPTS successfully and then fail while
    // refreshing its non-authoritative STATE_* mirror. A second wake is safe:
    // the command is idempotently no longer pending, so the worker immediately
    // returns ok=true without duplicating the mutation.
    if (firstAttempt.worker.ok === false) {
      retried = true;
      finalAttempt = await invokeWorker({
        scriptUrl,
        wakeSecret,
        bridgeId,
        commandId,
        signal: controller.signal,
      });
    }

    if (!finalAttempt.workerResponse.ok || finalAttempt.worker.ok !== true) {
      console.warn("[harbor-kick] Apps Script wake failed", {
        bridgeId,
        commandId,
        retried,
        firstHop: finalAttempt.firstHop,
        finalHop: finalAttempt.finalHop,
        bodyKind: finalAttempt.bodyKind,
      });
      return json(
        {
          ok: false,
          error: "worker wake failed",
          bridgeId,
          commandId,
          retried,
          diagnostics: {
            firstHop: finalAttempt.firstHop,
            finalHop: finalAttempt.finalHop,
          },
        },
        502,
      );
    }

    return json({
      ok: true,
      bridgeId,
      commandId,
      retried,
      processed:
        typeof firstAttempt.worker.processed === "number"
          ? firstAttempt.worker.processed
          : typeof finalAttempt.worker.processed === "number"
            ? finalAttempt.worker.processed
            : null,
      skipped:
        typeof finalAttempt.worker.skipped === "string"
          ? finalAttempt.worker.skipped
          : null,
      diagnostics: {
        firstHop: finalAttempt.firstHop,
        finalHop: finalAttempt.finalHop,
      },
    });
  } catch (error) {
    const rejectedFirstHop =
      error instanceof Error && "firstHop" in error
        ? (error as Error & { firstHop?: unknown }).firstHop
        : undefined;
    if (error instanceof Error && error.message === "WORKER_REDIRECT_REJECTED") {
      console.warn("[harbor-kick] rejected Google redirect", {
        bridgeId,
        commandId,
        firstHop: rejectedFirstHop,
      });
      return json(
        {
          ok: false,
          error: "worker redirect rejected",
          bridgeId,
          commandId,
          diagnostics: { firstHop: rejectedFirstHop },
        },
        502,
      );
    }

    console.warn("[harbor-kick] wake unavailable", {
      bridgeId,
      commandId,
      error: error instanceof Error ? error.name : "unknown",
    });
    return json(
      {
        ok: false,
        error:
          error instanceof Error && error.name === "AbortError"
            ? "worker wake timeout"
            : "worker wake unavailable",
        bridgeId,
        commandId,
      },
      504,
    );
  } finally {
    clearTimeout(timeout);
  }
}
