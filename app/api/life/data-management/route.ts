import { NextResponse } from "next/server";
import {
  createLifeBackupSnapshot,
  getLifeFullExport,
  importLifeFullData,
  listLifeBackupSnapshots,
  restoreLifeBackupSnapshot,
} from "@/lib/server/life-data-management";
import { resolveFixedLifeIdentity } from "@/lib/server/fixed-life-auth";
import {
  authorizeLifeRequest,
  LIFE_NO_STORE_HEADERS,
  lifeJsonError,
  readJsonBody,
} from "@/lib/server/life-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESTORE_CONFIRMATION = "确认恢复生活数据";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: Request) {
  const authError = await authorizeLifeRequest(request);
  if (authError) return authError;
  try {
    const snapshots = await listLifeBackupSnapshots();
    return NextResponse.json(
      { ok: true, snapshots, restoreConfirmation: RESTORE_CONFIRMATION },
      { headers: LIFE_NO_STORE_HEADERS },
    );
  } catch (error) {
    return lifeJsonError(error instanceof Error ? error.message : "读取备份记录失败", 502, "BACKUP_LIST_FAILED");
  }
}

export async function POST(request: Request) {
  const authError = await authorizeLifeRequest(request);
  if (authError) return authError;
  const identity = resolveFixedLifeIdentity(request);
  if (!identity) return lifeJsonError("请先登录", 401, "UNAUTHORIZED");

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const payload = asRecord(body.value);
  if (!payload) return lifeJsonError("请求格式不正确", 400, "BAD_REQUEST");

  const action = stringValue(payload.action);
  try {
    if (action === "create_backup") {
      const snapshot = await createLifeBackupSnapshot(identity.partnerKey, "full");
      return NextResponse.json({ ok: true, snapshot }, { headers: LIFE_NO_STORE_HEADERS });
    }

    if (action === "export") {
      const data = await getLifeFullExport();
      return NextResponse.json({ ok: true, data }, { headers: LIFE_NO_STORE_HEADERS });
    }

    if (action === "restore_backup") {
      const snapshotId = stringValue(payload.snapshotId);
      if (!isUuid(snapshotId)) return lifeJsonError("备份 ID 无效", 400, "BAD_SNAPSHOT_ID");
      if (stringValue(payload.confirmation) !== RESTORE_CONFIRMATION) {
        return lifeJsonError(`恢复前请输入“${RESTORE_CONFIRMATION}”`, 409, "RESTORE_CONFIRMATION_REQUIRED");
      }
      const result = await restoreLifeBackupSnapshot(snapshotId, identity.partnerKey);
      return NextResponse.json({ ok: true, result }, { headers: LIFE_NO_STORE_HEADERS });
    }

    if (action === "import_backup") {
      const data = asRecord(payload.data);
      if (!data) return lifeJsonError("导入文件不是有效的 JSON 对象", 400, "IMPORT_PAYLOAD_INVALID");
      if (stringValue(payload.confirmation) !== RESTORE_CONFIRMATION) {
        return lifeJsonError(`导入前请输入“${RESTORE_CONFIRMATION}”`, 409, "RESTORE_CONFIRMATION_REQUIRED");
      }
      const result = await importLifeFullData(data, identity.partnerKey);
      return NextResponse.json({ ok: true, result }, { headers: LIFE_NO_STORE_HEADERS });
    }

    return lifeJsonError("未知的数据管理操作", 400, "ACTION_INVALID");
  } catch (error) {
    return lifeJsonError(error instanceof Error ? error.message : "数据管理操作失败", 502, "DATA_MANAGEMENT_FAILED");
  }
}
