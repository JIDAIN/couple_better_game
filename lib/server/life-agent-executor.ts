import type { FixedLifeIdentity } from "./fixed-life-auth";
import {
  executeLifeAgentTool as executeCanonicalLifeAgentTool,
  LIFE_AGENT_TOOLS,
  type LifeAgentAttachment,
} from "./life-agent-registry";
import {
  camelizeDbRow,
  canonicalizeLifeUpdatePatch,
  pickActivityUpdateBase,
  pickMailboxUpdateBase,
  pickMealUpdateBase,
  pickMedicineUpdateBase,
  pickWeightUpdateBase,
} from "../ai/life-update-merge";
import { getLifeExport } from "./life-data-management";
import { listMedicines } from "./supabase-medicine";
import { listWeights } from "./supabase-weight";
import { listMailboxItems } from "./supabase-mailbox";

type JsonRecord = Record<string, unknown>;

type LifeAgentExecutionContext = {
  identity: FixedLifeIdentity;
  latestUserText: string;
  attachment?: LifeAgentAttachment | null;
  toolCallId?: string;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRows(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function canonicalResource(value: unknown) {
  const raw = stringValue(value).toLowerCase();
  const aliases: Record<string, string> = {
    三餐: "meal", 餐食: "meal", 饮食: "meal", 吃饭: "meal",
    体重: "weight",
    药箱: "medicine", 药品: "medicine", 药物: "medicine",
    活动: "activity",
    信箱: "mailbox", 小信箱: "mailbox", 信件: "mailbox",
  };
  return aliases[raw] || raw;
}

function isUpdateAction(value: unknown) {
  return ["update", "修改", "更新", "编辑"].includes(stringValue(value).toLowerCase());
}

function isDeleteAction(value: unknown) {
  return ["delete", "删除", "删掉", "移除"].includes(stringValue(value).toLowerCase());
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function wantsHydratedUpdate(row: JsonRecord) {
  if (isDeleteAction(row.action)) return false;
  if (isUpdateAction(row.action)) return true;
  return !stringValue(row.action) && Boolean(stringValue(row.id ?? row.recordId));
}

async function loadExportUser() {
  const payload = asRecord(await getLifeExport());
  return asRecord(payload.user);
}

async function loadExistingUpdateBase(
  resource: string,
  id: string,
  actor: "cat" | "fish",
): Promise<JsonRecord | null> {
  if (resource === "medicine") {
    const row = (await listMedicines()).find((item) => item.id === id);
    return row ? pickMedicineUpdateBase(row as unknown as JsonRecord) : null;
  }

  if (resource === "weight") {
    const row = (await listWeights(actor, 1000)).find((item) => item.id === id);
    return row ? pickWeightUpdateBase(row as unknown as JsonRecord) : null;
  }

  if (resource === "mailbox") {
    const row = (await listMailboxItems(actor)).find((item) => item.id === id);
    if (!row || row.senderKey !== actor || row.status !== "draft") return null;
    return pickMailboxUpdateBase(row as unknown as JsonRecord);
  }

  if (resource === "activity") {
    const user = await loadExportUser();
    const row = asRows(user.activity_entries)
      .map(camelizeDbRow)
      .find((item) => item.id === id && !item.deletedAt);
    if (!row) return null;
    const scope = stringValue(row.participantScope);
    if (scope !== actor && scope !== "both") return null;
    return pickActivityUpdateBase(row);
  }

  if (resource === "meal") {
    const user = await loadExportUser();
    const row = asRows(user.meals)
      .map(camelizeDbRow)
      .find((item) => item.id === id && !item.deletedAt);
    if (!row || row.partnerKey !== actor) return null;
    const items = asRows(user.meal_items)
      .map(camelizeDbRow)
      .filter((item) => item.mealId === id)
      .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
    return pickMealUpdateBase(row, items);
  }

  return null;
}

function assertActivityScope(
  scopeValue: unknown,
  actor: "cat" | "fish",
  existingScope?: string,
) {
  const scope = stringValue(scopeValue).toLowerCase();
  if (!scope || scope === "both" || scope === "me" || scope === actor || ["我", "自己", "本人"].includes(scope)) {
    if (existingScope === "both" && scope && scope !== "both") {
      throw new Error("双方共同活动不能由一方改成单方活动");
    }
    return;
  }
  throw new Error("个人活动只能写当前 OAuth 账号，不能指定 Ta");
}

async function hydratePartialUpdateArgs(args: unknown, context: LifeAgentExecutionContext) {
  const row = asRecord(args);
  if (!wantsHydratedUpdate(row)) return row;

  const resource = canonicalResource(row.resource);
  if (!["activity", "meal", "weight", "medicine", "mailbox"].includes(resource)) return row;

  const id = stringValue(row.id ?? row.recordId);
  if (!isUuid(id)) {
    throw new Error("修改已有记录需要有效的记录 ID；请先查询并定位唯一记录，不要猜测 ID");
  }

  const existing = await loadExistingUpdateBase(resource, id, context.identity.partnerKey);
  if (!existing) {
    throw new Error("没有找到可修改的目标记录，或当前账号无权修改该记录");
  }

  const patch = canonicalizeLifeUpdatePatch(resource, row.data);
  const merged = {
    ...existing,
    ...patch,
  };
  if (resource === "activity") {
    assertActivityScope(
      merged.participantScope,
      context.identity.partnerKey,
      stringValue(existing.participantScope),
    );
  }
  return {
    ...row,
    resource,
    action: "update",
    id,
    data: merged,
  };
}

async function assertActivityMutationBoundary(
  args: unknown,
  context: LifeAgentExecutionContext,
) {
  const row = asRecord(args);
  if (canonicalResource(row.resource) !== "activity") return;

  if (isDeleteAction(row.action)) {
    const id = stringValue(row.id ?? row.recordId);
    if (!isUuid(id)) {
      throw new Error("删除活动需要有效的记录 ID；请先查询并定位唯一记录，不要猜测 ID");
    }
    const existing = await loadExistingUpdateBase("activity", id, context.identity.partnerKey);
    if (!existing) {
      throw new Error("没有找到可删除的活动，或当前账号无权删除该记录");
    }
    return;
  }

  const data = asRecord(row.data);
  assertActivityScope(data.participantScope, context.identity.partnerKey);
}

export { LIFE_AGENT_TOOLS };
export type { LifeAgentAttachment };

export async function executeLifeAgentTool(
  name: string,
  args: unknown,
  context: LifeAgentExecutionContext,
) {
  const prepared = name === "life_mutate"
    ? await hydratePartialUpdateArgs(args, context)
    : args;
  if (name === "life_mutate") {
    await assertActivityMutationBoundary(prepared, context);
  }
  return executeCanonicalLifeAgentTool(name, prepared, context);
}
