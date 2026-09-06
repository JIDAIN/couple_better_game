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
import {
  isMealCreateMutation,
  isMealDraftConfirmationText,
  MEAL_DRAFT_CONFIRMATION_QUESTION,
} from "../ai/meal-draft-contract";
import { getLifeExport } from "./life-data-management";
import { listMedicines } from "./supabase-medicine";
import { listWeights } from "./supabase-weight";
import { listMailboxLetters } from "./supabase-mailbox";

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

function assertMealDraftConfirmed(args: unknown, context: LifeAgentExecutionContext) {
  if (!isMealCreateMutation(args)) return;
  if (isMealDraftConfirmationText(context.latestUserText)) return;
  throw new Error(MEAL_DRAFT_CONFIRMATION_QUESTION);
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
    const row = (await listMailboxLetters()).find((item) => item.id === id);
    return row ? pickMailboxUpdateBase(row as unknown as JsonRecord) : null;
  }

  if (resource === "activity") {
    const user = await loadExportUser();
    const row = asRows(user.activity_entries)
      .map(camelizeDbRow)
      .find((item) => item.id === id && !item.deletedAt);
    return row ? pickActivityUpdateBase(row) : null;
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
  return {
    ...row,
    resource,
    action: "update",
    id,
    data: {
      ...existing,
      ...patch,
    },
  };
}

export { LIFE_AGENT_TOOLS };
export type { LifeAgentAttachment };

export async function executeLifeAgentTool(
  name: string,
  args: unknown,
  context: LifeAgentExecutionContext,
) {
  if (name === "life_mutate") assertMealDraftConfirmed(args, context);
  const prepared = name === "life_mutate"
    ? await hydratePartialUpdateArgs(args, context)
    : args;
  return executeCanonicalLifeAgentTool(name, prepared, context);
}
