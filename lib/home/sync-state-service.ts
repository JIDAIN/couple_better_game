export type SyncErrorCode =
  | "MISSING_PASSWORD"
  | "WRONG_PASSWORD"
  | "RETRY_EXHAUSTED"
  | "IN_FLIGHT"
  | "SERVER_CONFIG"
  | "BAD_REQUEST"
  | "INVALID_DATA"
  | "LOCAL_DATA_NEEDS_SYNC"
  | "LOCAL_DIRTY_RELOAD_BLOCKED"
  | "CLOUD_SESSION_REQUIRED"
  | "CLOUD_READ_FAILED"
  | "CLOUD_WRITE_FAILED"
  | "CLOUD_NETWORK_ERROR"
  | "GITHUB_CONFLICT"
  | "GITHUB_READ_FAILED"
  | "GITHUB_WRITE_FAILED"
  | "GITHUB_NETWORK_ERROR"
  | "UNKNOWN";

export type SyncFailure = {
  reason: string;
  errorCode?: SyncErrorCode;
};

export type RemoteReloadDecision =
  | { ok: true }
  | { ok: false; reason: string; errorCode: SyncErrorCode };

export function guardRemoteReload({
  hasLocalData,
  hasUnsyncedChanges,
  hasLastSyncedAt,
  allowDirtyOverwrite,
}: {
  hasLocalData: boolean;
  hasUnsyncedChanges: boolean;
  hasLastSyncedAt: boolean;
  allowDirtyOverwrite: boolean;
}): RemoteReloadDecision {
  if (hasUnsyncedChanges && !allowDirtyOverwrite) {
    return {
      ok: false,
      reason: "当前有未同步修改，请先同步，或再次确认用云端数据覆盖本地",
      errorCode: "LOCAL_DIRTY_RELOAD_BLOCKED",
    };
  }

  if (hasLocalData && !hasLastSyncedAt && !allowDirtyOverwrite) {
    return {
      ok: false,
      reason: "本地已有数据但缺少上次同步记录，为避免覆盖，请先确认数据来源再同步",
      errorCode: "LOCAL_DATA_NEEDS_SYNC",
    };
  }

  return { ok: true };
}

export function shouldRetrySync({
  hasUnsyncedChanges,
  retryCount,
  maxRetry,
  errorCode,
}: {
  hasUnsyncedChanges: boolean;
  retryCount: number;
  maxRetry: number;
  errorCode: SyncErrorCode | null;
}) {
  if (!hasUnsyncedChanges) return false;
  if (
    errorCode === "WRONG_PASSWORD" ||
    errorCode === "MISSING_PASSWORD" ||
    errorCode === "CLOUD_SESSION_REQUIRED"
  ) {
    return false;
  }
  return retryCount < maxRetry;
}

export function shouldRunPendingAutoSync({
  pendingAutoSync,
  hasUnsyncedChanges,
  syncInFlight,
  errorCode,
}: {
  pendingAutoSync: boolean;
  hasUnsyncedChanges: boolean;
  syncInFlight: boolean;
  errorCode: SyncErrorCode | null;
}) {
  if (!pendingAutoSync) return false;
  if (!hasUnsyncedChanges) return false;
  if (syncInFlight) return false;
  return (
    errorCode !== "WRONG_PASSWORD" &&
    errorCode !== "MISSING_PASSWORD" &&
    errorCode !== "CLOUD_SESSION_REQUIRED"
  );
}

export function retryExhaustedMessage(lastReason: string | null) {
  return lastReason
    ? `自动同步多次失败：${lastReason}`
    : "自动同步多次失败，请进入数据管理手动同步";
}

export function isReloadOverwriteBlocked(errorCode: SyncErrorCode | undefined) {
  return (
    errorCode === "LOCAL_DIRTY_RELOAD_BLOCKED" ||
    errorCode === "LOCAL_DATA_NEEDS_SYNC"
  );
}
