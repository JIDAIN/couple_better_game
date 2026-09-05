import type { FixedLifeIdentity } from "./fixed-life-auth";
import { buildChatgptWriteIdempotencyKey } from "../ai/record-write-protocol";
import {
  normalizeLifeMutationArgs,
  normalizeLifeQueryArgs,
} from "../ai/life-input-normalizer";
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
      description: "查看岛屿生活 AI 当前可查询和可修改的资源、字段边界与安全规则。普通读写不要例行调用。",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "life_query",
      description: "查询岛屿生活真实数据。可使用自然常见别名；day/meal 未给日期时按 Asia/Shanghai 的今天处理。",
      parameters: {
        type: "object",
        properties: {
          resource: {
            type: "string",
            description: "day/month/meal/weight/medicine/mailbox/settings/life_export/legacy_home；也接受心情、睡眠、活动、三餐、体重、药箱、信箱、设置等常用中文别名。",
          },
          date: { type: "string", description: "可选 YYYY-MM-DD；day/meal 默认今天" },
          monthStart: { type: "string", description: "可选 YYYY-MM-01；month 默认本月" },
          person: { type: "string", description: "me/ta/all/cat/fish，也接受我、对象、双方等表达" },
          limit: { type: "integer", minimum: 1, maximum: 1000 },
          name: { type: "string", description: "medicine 名称模糊过滤，也可使用 query/keyword/medicineName" },
        },
        required: ["resource"],
        additionalProperties: true,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "life_mutate",
      description: "新增、修改或删除生活记录。优先传用户自然抽取出的字段，AI Access Core 会把常见别名规范化为 canonical contract；关键事实缺失时会返回需要向用户确认的问题。",
      parameters: {
        type: "object",
        properties: {
          resource: {
            type: "string",
            description: "mood/sleep/activity/meal/weight/medicine/mailbox/settings/legacy_home；也接受心情、睡眠、活动、三餐、体重、药品、信箱、设置等中文别名。",
          },
          action: { type: "string", description: "可选。记录/新增=create，修改=update，删除=delete；mood/sleep 默认 upsert，settings 默认 update。" },
          id: { type: "string", description: "update/delete 的记录 UUID；禁止猜测，不知道时先查询" },
          attachPhoto: { type: "boolean", description: "meal 是否绑定本轮图片" },
          data: {
            type: "object",
            description: "自然抽取出的业务字段。允许常见别名，例如 meal item 可用 name/foodName/rawName，weight 可用 weight/weightKg，medicine 可用 medicineName/name。",
            additionalProperties: true,
          },
        },
        required: ["resource", "data"],
        additionalProperties: true,
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
    naturalInput: {
      principle: "模型负责理解用户意图和抽取实体；AI Access Core 负责别名、默认值、日期/数量格式归一化；canonical service 继续严格校验。",
      clarification: "缺少真正不可安全推断的信息时，服务端返回“需要向用户确认：...”的问题；不要让用户排查内部字段名。",
      defaults: [
        "day/meal/mood/sleep/activity/weight 未给日期时默认 Asia/Shanghai 今天",
        "medicine 新增未给数量时默认 1",
        "meal 的 name/foodName/rawName 都会归一为 rawName",
        "meal 的 quantity 或 amount+unit 会归一为 portionDescription",
      ],
    },
    query: {
      day: "某日心情、睡眠、活动；日期默认今天",
      month: "某月双人心情；默认本月",
      meal: "按日期与 me/ta/all 查询餐食；日期默认今天",
      weight: "按 me/ta 查询体重历史",
      medicine: "家庭药箱，可按药名/关键词过滤",
      mailbox: "小信箱全部信件",
      settings: "周年日、当前两人的目标体重",
      life_export: "V2 生活数据完整导出",
      legacy_home: "旧 /game 完整同步快照",
    },
    mutate: {
      mood: "upsert；自然字段 mood/moodKey/label + date 可归一；身份强制当前账号",
      sleep: "upsert；支持 bedtime/sleepTime 与 wakeTime 等别名；缺时间时向用户确认",
      activity: "create/update/delete；支持 name/text/description、duration/分钟/小时等常见输入",
      meal: "create/update/delete；items[].name/foodName/rawName 均可；quantity 或 amount+unit 可表示份量；可 attachPhoto",
      weight: "create/update/delete；weight/weightKg/kg/value 均可；缺体重数值时向用户确认",
      medicine: "create/update/delete；medicineName/drugName/name 均可；数量缺省为 1",
      mailbox: "create/update/delete；body/content/text/message 均可；发件人/收件人由服务端固定",
      settings: "update；支持 anniversary/anniversaryDate、targetWeight/targetWeightKg",
      legacy_home: "replace；仍要求用户当前消息明确包含“确认覆盖游戏数据”",
    },
    safety: [
      "没有任意 SQL 或任意 URL 工具",
      "删除只在用户当前消息明确要求删除时执行",
      "个人数据写入不能指定为 Ta",
      "update/delete 的记录 ID 不允许自动猜测",
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
  if (name === "life_query") {
    const normalized = normalizeLifeQueryArgs(record, {
      latestUserText: context.latestUserText,
      actor: context.identity.partnerKey,
      hasAttachment: Boolean(context.attachment),
    });
    return queryLife(normalized, context);
  }
  if (name === "life_mutate") {
    const normalized = normalizeLifeMutationArgs(record, {
      latestUserText: context.latestUserText,
      actor: context.identity.partnerKey,
      hasAttachment: Boolean(context.attachment),
    });
    return mutateLife(normalized, context);
  }
  throw new Error(`未知 AI 工具：${name}`);
}
