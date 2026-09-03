export type LifeBackupSnapshot = {
  id: string;
  scope: "user" | "config" | "full";
  reason: "manual" | "scheduled" | "pre_restore" | "import";
  schemaVersion: number;
  rowCounts: Record<string, number>;
  createdBy: "cat" | "fish" | null;
  createdAt: string;
};

type ApiErrorBody = { error?: string };

export class LifeDataManagementClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(init?: RequestInit) {
  const response = await fetch("/api/life/data-management", {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as (T & ApiErrorBody) | null;
  if (!response.ok || !body) {
    throw new LifeDataManagementClientError(body?.error ?? "数据管理操作失败", response.status);
  }
  return body;
}

export async function fetchLifeBackups() {
  return request<{ ok: true; snapshots: LifeBackupSnapshot[]; restoreConfirmation: string }>();
}

export async function createLifeBackup() {
  return request<{ ok: true; snapshot: LifeBackupSnapshot }>({
    method: "POST",
    body: JSON.stringify({ action: "create_backup" }),
  });
}

export async function exportLifeData() {
  return request<{ ok: true; data: Record<string, unknown> }>({
    method: "POST",
    body: JSON.stringify({ action: "export" }),
  });
}

export async function restoreLifeBackup(snapshotId: string, confirmation: string) {
  return request<{ ok: true; result: Record<string, unknown> }>({
    method: "POST",
    body: JSON.stringify({ action: "restore_backup", snapshotId, confirmation }),
  });
}

export async function importLifeBackup(data: Record<string, unknown>, confirmation: string) {
  return request<{ ok: true; result: Record<string, unknown> }>({
    method: "POST",
    body: JSON.stringify({ action: "import_backup", data, confirmation }),
  });
}
