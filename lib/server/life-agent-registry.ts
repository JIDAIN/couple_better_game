import type { FixedLifeIdentity } from "./fixed-life-auth";
import { buildChatgptWriteIdempotencyKey } from "../ai/record-write-protocol";
import {
  parseActivityWritePayload,
  parseMoodWritePayload,
  parseSleepWritePayload,
} from "../life/life-service";
import { parseMailboxPayload } from "../life/mailbox-service";
import { parseMedicinePayload } from "../life/medicine-service";
import { parseWeightWritePayload } from "../life/weight-service";
import { parseMealWritePayload } from "../nutrition/meal-service";
import {
  createActivity,
  deleteActivity,
  getLifeDay,
  getLifeMonthMoods,
  updateActivity,
  upsertMood,
  upsertSleep,
} from "./supabase-life";
import {
  buildMealPhotoPath,
  createMeal,
  deleteMeal,
  deleteMealPhotoObject,
  getMealOwner,
  listMeals,
  replaceMealPhotoPath,
  updateMeal,
  uploadMealPhotoObject,
} from "./supabase-nutrition";
import {
  createMedicine,
  deleteMedicine,
  listMedicines,
  updateMedicine,
} from "./supabase-medicine";
import {
  createWeight,
  deleteWeight,
  listWeights,
  updateWeight,
} from "./supabase-weight";
import {
  createMailboxLetter,
  deleteMailboxLetter,
  getMailboxSender,
  listMailboxLetters,
  updateMailboxLetter,
} from "./supabase-mailbox";
import { getLifeExport, getLifeSettings, updateLifeSettings } from "./life-data-management";
import { loadHomeSyncSnapshot, saveHomeSyncSnapshot } from "./supabase-home-sync";

export type LifeAgentAttachment = {
  bytes: Buffer;
  contentType: "image/webp";
  extension: "webp";
  width: number | null;
  height: number | null;
  outputBytes: number;
};

export type LifeAgentExecutionContext = {
  identity: FixedLifeIdentity;
  latestUserText: string;
  attachment?: LifeAgentAttachment | null;
  toolCallId?: string;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function otherPartnerKey(partnerKey: "cat" | "fish") {
  return partnerKey === "cat" ? "fish" : "cat";
}

function resolvePerson(
  value: unknown,
  identity: FixedLifeIdentity,
  allowAll = false,
): "cat" | "fish" | null {
  if (value === "me" || value == null || value === "") return identity.partnerKey;
  if (value === "ta") return otherPartnerKey(identity.partnerKey);
  if (allowAll && value === "all") return null;
  if (value === "cat" || value === "fish") return value;
  throw new Error("person 只能是 me、ta、cat、fish" + (allowAll ? " 或 all" : ""));
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function requireId(args: JsonRecord) {
  const id = stringValue(args.id);
  if (!isUuid(id)) throw new Error("需要有效的记录 ID；请先查询记录再修改或删除");
  return id;
}

function isExplicitDelete(text: string) {
  return /(删除|删掉|删了|移除|清除|remove|delete)/i.test(text);
}

function requireExplicitDelete(context: LifeAgentExecutionContext) {
  if (!isExplicitDelete(context.latestUserText)) {
    throw new Error("删除属于破坏性操作，只有用户当前消息明确要求删除时才能执行");
  }
}

function idempotencyKey(domain: "meal" | "mood" | "sleep" | "activity", context: LifeAgentExecutionContext, date: string) {
  return buildChatgptWriteIdempotencyKey({
    domain,
    scope: `internal-${context.identity.partnerKey}`,
    recordDate: date,
    confirmationNonce: context.toolCallId || crypto.randomUUID(),
  });
}

async function bindAttachmentToMeal(mealId: string, attachment: LifeAgentAttachment) {
  const path = buildMealPhotoPath(mealId, attachment.extension);
  await uploadMealPhotoObject(
    path,
    attachment.bytes.buffer.slice(
      attachment.bytes.byteOffset,
      attachment.bytes.byteOffset + attachment.bytes.byteLength,
    ) as ArrayBuffer,
    attachment.contentType,
  );
  try {
    const replacement = await replaceMealPhotoPath(mealId, path);
    if (replacement.previousPhotoPath) {
      await deleteMealPhotoObject(replacement.previousPhotoPath).catch(() => undefined);
    }
    return replacement.meal;
  } catch (error) {
    await deleteMealPhotoObject(path).catch(() => undefined);
    throw error;
  }
}

export const LIFE_AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "life_capabilities",
      description: "查看岛屿生活 AI 当前可查询和可修改的资源、字段边界与安全规则。",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "life_query",
      description: "查询岛屿生活真实数据。涉及事实时先查询，不要凭聊天记忆猜测。",
      parameters: {
        type: "object",
        properties: {
          resource: {
            type: "string",
            enum: ["day", "month", "meal", "weight", "medicine", "mailbox", "settings", "life_export", "legacy_home"],
          },
          date: { type: "string", description: "YYYY-MM-DD，day/meal 使用" },
          monthStart: { type: "string", description: "YYYY-MM-01，month 使用" },
          person: { type: "string", enum: ["me", "ta", "all", "cat", "fish"] },
          limit: { type: "integer", minimum: 1, maximum: 1000 },
          name: { type: "string", description: "medicine 名称模糊过滤" },
        },
        required: ["resource"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "life_mutate",
      description: "像当前登录用户一样新增、修改或删除岛屿生活记录。个人记录会在服务端强制绑定当前账号，不能冒充 Ta。",
      parameters: {
        type: "object",
        properties: {
          resource: {
            type: "string",
            enum: ["mood", "sleep", "activity", "meal", "weight", "medicine", "mailbox", "settings", "legacy_home"],
          },
          action: { type: "string", enum: ["create", "update", "delete", "upsert", "replace"] },
          id: { type: "string", description: "update/delete 时的记录 UUID" },
          attachPhoto: { type: "boolean", description: "meal create/update 是否把本轮用户上传图片绑定为餐食照片" },
          data: { type: "object", additionalProperties: true },
        },
        required: ["resource", "action", "data"],
        additionalProperties: false,
      },
    },
  },
] as const;

function capabilities(identity: FixedLifeIdentity) {
  return {
    identity: {
      me: identity.partnerKey,
      ta: otherPartnerKey(identity.partnerKey),
      displayName: identity.displayName,
    },
    query: {
      day: "某日心情、睡眠、活动",
      month: "某月双人心情",
      meal: "按日期与 me/ta/all 查询餐食",
      weight: "按 me/ta 查询体重历史",
      medicine: "家庭药箱，可按名称过滤",
      mailbox: "小信箱全部信件",
      settings: "周年日、当前两人的目标体重",
      life_export: "V2 生活数据完整导出：心情、睡眠、活动、餐食及明细、药箱、体重、信箱、伴侣资料",
      legacy_home: "旧 /game 完整同步快照",
    },
    mutate: {
      mood: "upsert；partnerKey 强制为当前账号；data: moodDate,moodKey",
      sleep: "upsert；partnerKey 强制为当前账号；data: sleepDate,fellAsleepAt,wokeAt",
      activity: "create/update/delete；data: activityDate,text,participantScope,occurredAt?,activityType?,durationMinutes?",
      meal: "create/update/delete；partnerKey 强制为当前账号；data 使用 MealWritePayload 字段，source/status/idempotencyKey 由服务端覆盖；可 attachPhoto",
      weight: "create/update/delete；partnerKey 强制为当前账号；data: measurementDate,measuredAt?,weightKg,note?",
      medicine: "create/update/delete；共享药箱；data: name,productionDate?,shelfLifeMonths?,packageExpiryDate?,openedDate?,openedShelfLifeDays?,quantity,note?",
      mailbox: "create/update/delete；sender 强制当前账号、recipient 强制 Ta；不能修改/删除 Ta 发出的信",
      settings: "update；anniversaryDate 为共享设置，targetWeightKg 只修改当前账号",
      legacy_home: "replace；仅当用户当前消息明确包含“确认覆盖游戏数据”时允许覆盖完整旧游戏快照",
    },
    safety: [
      "没有任意 SQL 或任意 URL 工具",
      "删除只在用户当前消息明确要求删除时执行",
      "个人数据写入不能指定为 Ta",
      "旧游戏全量覆盖需要用户说出：确认覆盖游戏数据",
    ],
  };
}

async function queryLife(args: JsonRecord, context: LifeAgentExecutionContext) {
  const resource = stringValue(args.resource);
  switch (resource) {
    case "day": {
      const date = stringValue(args.date);
      if (!date) throw new Error("day 查询需要 date");
      return getLifeDay(date);
    }
    case "month": {
      const monthStart = stringValue(args.monthStart);
      if (!monthStart) throw new Error("month 查询需要 monthStart");
      return getLifeMonthMoods(monthStart);
    }
    case "meal": {
      const date = stringValue(args.date);
      if (!date) throw new Error("meal 查询需要 date");
      return listMeals({ mealDate: date, partnerKey: resolvePerson(args.person, context.identity, true) });
    }
    case "weight": {
      const partnerKey = resolvePerson(args.person, context.identity, false);
      if (!partnerKey) throw new Error("weight 不能使用 all");
      const limit = Math.max(1, Math.min(1000, Number(args.limit ?? 365) || 365));
      return listWeights(partnerKey, limit);
    }
    case "medicine": {
      const medicines = await listMedicines();
      const name = stringValue(args.name).toLowerCase();
      return name ? medicines.filter((item) => item.name.toLowerCase().includes(name)) : medicines;
    }
    case "mailbox":
      return listMailboxLetters();
    case "settings":
      return getLifeSettings();
    case "life_export":
      return getLifeExport();
    case "legacy_home":
      return loadHomeSyncSnapshot();
    default:
      throw new Error(`不支持的查询资源：${resource || "(empty)"}`);
  }
}

async function mutateLife(args: JsonRecord, context: LifeAgentExecutionContext) {
  const resource = stringValue(args.resource);
  const action = stringValue(args.action);
  const data = asRecord(args.data);
  const actor = context.identity.partnerKey;
  const ta = otherPartnerKey(actor);

  if (action === "delete") requireExplicitDelete(context);

  switch (resource) {
    case "mood": {
      if (action !== "upsert") throw new Error("mood 只支持 upsert");
      const date = stringValue(data.moodDate);
      const parsed = parseMoodWritePayload({
        ...data,
        partnerKey: actor,
        source: "chatgpt",
        idempotencyKey: idempotencyKey("mood", context, date),
      });
      if (!parsed.ok) throw new Error(parsed.reason);
      return upsertMood(parsed.value);
    }
    case "sleep": {
      if (action !== "upsert") throw new Error("sleep 只支持 upsert");
      const date = stringValue(data.sleepDate);
      const parsed = parseSleepWritePayload({
        ...data,
        partnerKey: actor,
        source: "chatgpt",
        idempotencyKey: idempotencyKey("sleep", context, date),
      });
      if (!parsed.ok) throw new Error(parsed.reason);
      return upsertSleep(parsed.value);
    }
    case "activity": {
      if (action === "delete") return deleteActivity(requireId(args));
      if (action !== "create" && action !== "update") throw new Error("activity 只支持 create/update/delete");
      const date = stringValue(data.activityDate);
      const parsed = parseActivityWritePayload({
        ...data,
        source: "chatgpt",
        idempotencyKey: idempotencyKey("activity", context, date),
      });
      if (!parsed.ok) throw new Error(parsed.reason);
      return action === "create" ? createActivity(parsed.value) : updateActivity(requireId(args), parsed.value);
    }
    case "meal": {
      if (action === "delete") {
        const id = requireId(args);
        const owner = await getMealOwner(id);
        if (owner !== actor) throw new Error("只能删除当前账号自己的餐食");
        return deleteMeal(id);
      }
      if (action !== "create" && action !== "update") throw new Error("meal 只支持 create/update/delete");
      const date = stringValue(data.mealDate);
      const parsed = parseMealWritePayload({
        ...data,
        partnerKey: actor,
        status: "confirmed",
        source: "chatgpt",
        idempotencyKey: idempotencyKey("meal", context, date),
      });
      if (!parsed.ok) throw new Error(parsed.reason);
      let meal;
      if (action === "create") {
        meal = await createMeal(parsed.value);
      } else {
        const id = requireId(args);
        const owner = await getMealOwner(id);
        if (owner !== actor) throw new Error("只能修改当前账号自己的餐食");
        meal = await updateMeal(id, parsed.value);
      }
      if (args.attachPhoto === true) {
        if (!context.attachment) throw new Error("本轮没有可绑定的图片附件");
        meal = await bindAttachmentToMeal(meal.id, context.attachment);
      }
      return meal;
    }
    case "weight": {
      if (action === "delete") {
        const id = requireId(args);
        const ownRows = await listWeights(actor, 1000);
        if (!ownRows.some((row) => row.id === id)) throw new Error("只能删除当前账号自己的体重记录");
        return deleteWeight(id);
      }
      if (action !== "create" && action !== "update") throw new Error("weight 只支持 create/update/delete");
      const parsed = parseWeightWritePayload({ ...data, partnerKey: actor });
      if (!parsed.ok) throw new Error(parsed.reason);
      if (action === "update") {
        const id = requireId(args);
        const ownRows = await listWeights(actor, 1000);
        if (!ownRows.some((row) => row.id === id)) throw new Error("只能修改当前账号自己的体重记录");
        return updateWeight(id, parsed.value);
      }
      return createWeight(parsed.value);
    }
    case "medicine": {
      if (action === "delete") return deleteMedicine(requireId(args));
      if (action !== "create" && action !== "update") throw new Error("medicine 只支持 create/update/delete");
      const parsed = parseMedicinePayload(data);
      if (!parsed.ok) throw new Error(parsed.reason);
      return action === "create" ? createMedicine(parsed.value) : updateMedicine(requireId(args), parsed.value);
    }
    case "mailbox": {
      if (action === "delete") {
        const id = requireId(args);
        if ((await getMailboxSender(id)) !== actor) throw new Error("只能删除当前账号自己发出的信");
        return deleteMailboxLetter(id);
      }
      if (action !== "create" && action !== "update") throw new Error("mailbox 只支持 create/update/delete");
      const parsed = parseMailboxPayload({ ...data, senderKey: actor, recipientKey: ta });
      if (!parsed.ok) throw new Error(parsed.reason);
      if (action === "update") {
        const id = requireId(args);
        if ((await getMailboxSender(id)) !== actor) throw new Error("只能修改当前账号自己发出的信");
        return updateMailboxLetter(id, parsed.value);
      }
      return createMailboxLetter(parsed.value);
    }
    case "settings": {
      if (action !== "update") throw new Error("settings 只支持 update");
      const allowed: JsonRecord = {};
      if ("anniversaryDate" in data) allowed.anniversaryDate = data.anniversaryDate;
      if ("targetWeightKg" in data) allowed.targetWeightKg = data.targetWeightKg;
      if (Object.keys(allowed).length === 0) throw new Error("settings 没有可更新字段");
      return updateLifeSettings(allowed, actor);
    }
    case "legacy_home": {
      if (action !== "replace") throw new Error("legacy_home 只支持 replace");
      if (!context.latestUserText.includes("确认覆盖游戏数据")) {
        throw new Error("覆盖旧游戏完整快照前，用户当前消息必须明确包含：确认覆盖游戏数据");
      }
      return saveHomeSyncSnapshot(data);
    }
    default:
      throw new Error(`不支持的修改资源：${resource || "(empty)"}`);
  }
}

export async function executeLifeAgentTool(
  name: string,
  args: unknown,
  context: LifeAgentExecutionContext,
) {
  const record = asRecord(args);
  if (name === "life_capabilities") return capabilities(context.identity);
  if (name === "life_query") return queryLife(record, context);
  if (name === "life_mutate") return mutateLife(record, context);
  throw new Error(`未知 AI 工具：${name}`);
}
