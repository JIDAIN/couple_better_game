import { describe, expect, it } from "vitest";
import {
  guardRemoteReload,
  isReloadOverwriteBlocked,
  retryExhaustedMessage,
  shouldRetrySync,
  shouldRunPendingAutoSync,
} from "../../lib/home/sync-state-service";

describe("sync state service", () => {
  it("keeps a pending auto sync when another sync is in flight", () => {
    expect(
      shouldRunPendingAutoSync({
        pendingAutoSync: true,
        hasUnsyncedChanges: true,
        syncInFlight: false,
        errorCode: null,
      }),
    ).toBe(true);

    expect(
      shouldRunPendingAutoSync({
        pendingAutoSync: true,
        hasUnsyncedChanges: true,
        syncInFlight: true,
        errorCode: null,
      }),
    ).toBe(false);
  });

  it("does not retry wrong password or missing password failures", () => {
    expect(
      shouldRetrySync({
        hasUnsyncedChanges: true,
        retryCount: 0,
        maxRetry: 3,
        errorCode: "WRONG_PASSWORD",
      }),
    ).toBe(false);

    expect(
      shouldRetrySync({
        hasUnsyncedChanges: true,
        retryCount: 0,
        maxRetry: 3,
        errorCode: "MISSING_PASSWORD",
      }),
    ).toBe(false);
  });

  it("stops retrying after the retry limit and keeps a visible reason", () => {
    expect(
      shouldRetrySync({
        hasUnsyncedChanges: true,
        retryCount: 2,
        maxRetry: 3,
        errorCode: "GITHUB_NETWORK_ERROR",
      }),
    ).toBe(true);

    expect(
      shouldRetrySync({
        hasUnsyncedChanges: true,
        retryCount: 3,
        maxRetry: 3,
        errorCode: "GITHUB_NETWORK_ERROR",
      }),
    ).toBe(false);

    expect(retryExhaustedMessage("连接 GitHub 失败")).toBe(
      "自动同步多次失败：连接 GitHub 失败",
    );
  });

  it("blocks remote reload when local dirty data would be overwritten", () => {
    const decision = guardRemoteReload({
      hasLocalData: true,
      hasUnsyncedChanges: true,
      hasLastSyncedAt: true,
      allowDirtyOverwrite: false,
    });

    expect(decision).toMatchObject({
      ok: false,
      errorCode: "LOCAL_DIRTY_RELOAD_BLOCKED",
    });
    expect(
      isReloadOverwriteBlocked(
        decision.ok ? undefined : decision.errorCode,
      ),
    ).toBe(true);
  });

  it("blocks remote reload when local data has no sync meta", () => {
    expect(
      guardRemoteReload({
        hasLocalData: true,
        hasUnsyncedChanges: false,
        hasLastSyncedAt: false,
        allowDirtyOverwrite: false,
      }),
    ).toMatchObject({
      ok: false,
      errorCode: "LOCAL_DATA_NEEDS_SYNC",
    });
  });

  it("allows explicit overwrite after confirmation", () => {
    expect(
      guardRemoteReload({
        hasLocalData: true,
        hasUnsyncedChanges: true,
        hasLastSyncedAt: true,
        allowDirtyOverwrite: true,
      }),
    ).toEqual({ ok: true });
  });
});
