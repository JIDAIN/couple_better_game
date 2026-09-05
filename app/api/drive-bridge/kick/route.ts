import { NextResponse } from "next/server";
import { parseDriveBridgeId } from "@/lib/server/drive-bridge-auth";
import {
  googleWebAppHop,
  parseAllowedGoogleWebAppRedirect,
} from "@/lib/server/drive-bridge-google-webapp";
import { getDriveBridgeCommandLedger } from "@/lib/server/drive-bridge-ledger";
import { shouldAvoidSecondHarborWake } from "@/lib/server/drive-bridge-kick-policy";
import { raceHarborWorkerAndLedger } from "@/lib/server/drive-bridge-kick-race";
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type WakeAttempt = {
  workerResponse: Response;
  worker: Record<string, unknown>;
  firstHop: ReturnType<typeof googleWebAppHop>;
  finalHop: ReturnType<typeof googleWebAppHop>;
  bodyKind: "json-like" | "html-like" | "other";
};

type FinalizedLedger = {
  status: "succeeded" | "failed";
  receipt: unknown;
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

async function finalizedLedgerState(
  bridgeId: "cat" | "fish",
  commandId: string,
): Promise<FinalizedLedger | null> {
  try {
    const row = await getDriveBridgeCommandLedger(bridgeId, commandId);
    if (!row || row.status === "processing" || row.receipt == null) return null;
    return { status: row.status, receipt: row.receipt };
  } catch (error) {
    console.warn("[harbor-kick] ledger reconciliation unavailable", {
      bridgeId,
      commandId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

async function waitForFinalizedLedger(
  bridgeId: "cat" | "fish",
  commandId: string,
  waitMs = 2400,
) {
  const started = Date.now();
  while (Date.now() - started < waitMs) {
    const ledger = await finalizedLedgerState(bridgeId, commandId);
    if (ledger) return ledger;
    await sleep(200);
  }
  return finalizedLedgerState(bridgeId, commandId);
}

function reconciledSuccess(options: {
  bridgeId: "cat" | "fish";
  commandId: string;
  retried: boolean;
  ledgerStatus: "succeeded" | "failed";
  attempt: WakeAttempt;
}) {
  const { bridgeId, commandId, retried, ledgerStatus, attempt } = options;
  return json({
    ok: true,
    bridgeId,
    commandId,
    retried,
    reconciledFromLedger: true,
    ledgerFirst: false,
    commandStatus: ledgerStatus,
    receiptReady: true,
    processed: typeof attempt.worker.processed === "number" ? attempt.worker.processed : 0,
    skipped: typeof attempt.worker.skipped === "string" ? attempt.worker.skipped : null,
    diagnostics: {
      firstHop: attempt.firstHop,
      finalHop: attempt.finalHop,
    },
  });
}

function ledgerFirstSuccess(options: {
  bridgeId: "cat" | "fish";
  commandId: string;
  ledgerStatus: "succeeded" | "failed";
}) {
  const { bridgeId, commandId, ledgerStatus } = options;
  return json({
    ok: true,
    bridgeId,
    commandId,
    retried: false,
    reconciledFromLedger: true,
    ledgerFirst: true,
    commandStatus: ledgerStatus,
    receiptReady: true,
    processed: 0,
    skipped: null,
  });
}

function acceptedWhileLocked(options: {
  bridgeId: "cat" | "fish";
  commandId: string;
  attempt: WakeAttempt;
}) {
  const { bridgeId, commandId, attempt } = options;
  return json({
    ok: true,
    accepted: true,
    bridgeId,
    commandId,
    retried: false,
    reconciledFromLedger: false,
    ledgerFirst: false,
    commandStatus: "processing",
    receiptReady: false,
    processed: 0,
    skipped: "locked",
    retryAfterMs: 1000,
    diagnostics: {
      firstHop: attempt.firstHop,
      finalHop: attempt.finalHop,
    },
  });
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
    // R10.3.1: race the Apps Script HTTP request against the authoritative
    // Supabase command ledger. The worker can finish the business command and
    // write RECEIPT several seconds before Apps Script finishes snapshot/post-
    // processing. As soon as a finalized receipt exists, stop waiting on that
    // HTTP client request and let Harbor read the exact RECEIPT.
    const firstRace = await raceHarborWorkerAndLedger({
      worker: invokeWorker({
        scriptUrl,
        wakeSecret,
        bridgeId,
        commandId,
        signal: controller.signal,
      }),
      readLedger: () => finalizedLedgerState(bridgeId, commandId),
      abortWorker: () => controller.abort(),
      maxLedgerWaitMs: 8_000,
      pollIntervalMs: 250,
    });

    if (firstRace.kind === "ledger") {
      return ledgerFirstSuccess({
        bridgeId,
        commandId,
        ledgerStatus: firstRace.ledger.status,
      });
    }

    if (firstRace.kind === "worker-error") {
      throw firstRace.error;
    }

    const firstAttempt = firstRace.worker;

    if (!firstAttempt.workerResponse.ok) {
      const ledger = await finalizedLedgerState(bridgeId, commandId);
      if (ledger) {
        return reconciledSuccess({
          bridgeId,
          commandId,
          retried: false,
          ledgerStatus: ledger.status,
          attempt: firstAttempt,
        });
      }

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

    if (firstAttempt.worker.ok === false) {
      // A script lock means another trigger/wake already owns command processing.
      // Do not send a second wake and make it queue on the same lock. Give the
      // authoritative ledger a short window to finish instead.
      if (shouldAvoidSecondHarborWake(firstAttempt.worker)) {
        const ledger = await waitForFinalizedLedger(bridgeId, commandId);
        if (ledger) {
          return reconciledSuccess({
            bridgeId,
            commandId,
            retried: false,
            ledgerStatus: ledger.status,
            attempt: firstAttempt,
          });
        }
        return acceptedWhileLocked({ bridgeId, commandId, attempt: firstAttempt });
      }

      const ledger = await finalizedLedgerState(bridgeId, commandId);
      if (ledger) {
        return reconciledSuccess({
          bridgeId,
          commandId,
          retried: false,
          ledgerStatus: ledger.status,
          attempt: firstAttempt,
        });
      }

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
      const ledger = await finalizedLedgerState(bridgeId, commandId);
      if (ledger) {
        return reconciledSuccess({
          bridgeId,
          commandId,
          retried,
          ledgerStatus: ledger.status,
          attempt: finalAttempt,
        });
      }

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
      reconciledFromLedger: false,
      ledgerFirst: false,
      receiptReady: true,
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

    const ledger = await finalizedLedgerState(bridgeId, commandId);
    if (ledger) {
      return json({
        ok: true,
        bridgeId,
        commandId,
        retried: false,
        reconciledFromLedger: true,
        ledgerFirst: false,
        commandStatus: ledger.status,
        receiptReady: true,
        processed: 0,
        skipped: null,
      });
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
