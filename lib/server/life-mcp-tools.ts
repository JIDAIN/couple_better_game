import { isChatgptWriteIdempotencyKey } from "@/lib/ai/record-write-protocol";
import {
  parseActivityWritePayload,
  parseMoodWritePayload,
  parseSleepWritePayload,
} from "@/lib/life/life-service";
import { prepareConfirmedChatgptMeal } from "@/lib/nutrition/chatgpt-meal-protocol";
import type { NutritionPartnerKey } from "@/lib/nutrition/meal-service";
import { compressMealPhoto, MEAL_PHOTO_MAX_INPUT_BYTES } from "@/lib/server/image-compression";
import type { LifeMcpAccessIdentity } from "@/lib/server/life-mcp-auth";
import { createChatgptMeal } from "@/lib/server/supabase-chatgpt-meal";
import { createActivity, getLifeDay, upsertMood, upsertSleep } from "@/lib/server/supabase-life";
import { listMedicines } from "@/lib/server/supabase-medicine";
import {
  buildMealPhotoPath,
  deleteMealPhotoObject,
  listMeals,
  replaceMealPhotoPath,
  uploadMealPhotoObject,
} from "@/lib/server/supabase-nutrition";
import { listWeights } from "@/lib/server/supabase-weight";

export type LifeMcpToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

type FileReference = {
  download_url: string;
  file_id: string;
  mime_type?: string;
  file_name?: string;
};

const GENERIC_FILTERS_SCHEMA = {
  type: "object",
  additionalProperties: true,
  description: "Domain-specific filters. Use date YYYY-MM-DD where a date is needed.",
};

const FILE_REFERENCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    download_url: { type: "string" },
    file_id: { type: "string" },
    mime_type: { type: "string" },
    file_name: { type: "string" },
  },
  required: ["download_url", "file_id"],
};

export const LIFE_MCP_TOOLS: LifeMcpToolDefinition[] = [
  {
    name: "life_capabilities",
    title: "查看生活记录能力",
    description:
      "返回当前生活记录服务端已注册的 domain 与操作。工具本身保持稳定；以后新增生理期等模块时只需服务端注册新 domain，不需要更换 MCP 地址。",
    inputSchema: { type: "object", additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "life_query",
    title: "查询生活记录",
    description:
      "通过稳定入口查询生活记录。当前支持 medicine、meal、weight、day、mood、sleep、activity；先调用 life_capabilities 可查看最新服务端能力。",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        domain: { type: "string", description: "服务端注册的 domain，例如 medicine、meal、day。" },
        filters: GENERIC_FILTERS_SCHEMA,
      },
      required: ["domain"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "life_write",
    title: "写入生活记录",
    description:
      "在用户明确要求保存/修改后写入生活记录。当前已开放 meal、mood、sleep、activity。必须提供 confirmed=true 和 chatgpt:<domain>: 开头的稳定幂等键。meal 可同时接收当前聊天中用户上传的照片。",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        domain: { type: "string" },
        action: { type: "string", description: "当前写入使用 create 或 upsert。" },
        confirmed: {
          type: "boolean",
          description: "只有用户在当前对话中明确要求记上/保存/修改时才可设为 true。",
        },
        idempotencyKey: {
          type: "string",
          description: "稳定重试键，格式必须以 chatgpt:<domain>: 开头。对同一用户确认重试时保持不变。",
        },
        payload: {
          type: "object",
          additionalProperties: true,
          description: "domain 对应的结构化记录。个人记录的 partnerKey 由 OAuth 身份强制决定。",
        },
        file: FILE_REFERENCE_SCHEMA,
      },
      required: ["domain", "action", "confirmed", "idempotencyKey", "payload"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: {
      "openai/fileParams": ["file"],
      "openai/toolInvocation/invoking": "正在保存生活记录…",
      "openai/toolInvocation/invoked": "生活记录已保存",
    },
  },
];

function result(value: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

function errorResult(message: string, code: string): ToolResult {
  return {
    content: [{ type: "text", text: `${code}: ${message}` }],
    structuredContent: { ok: false, error: message, errorCode: code },
    isError: true,
  };
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function partner(value: unknown, fallback: NutritionPartnerKey): NutritionPartnerKey | null {
  if (value === "cat" || value === "fish") return value;
  if (value == null || value === "" || value === "me") return fallback;
  return null;
}

function validIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function assertScope(identity: LifeMcpAccessIdentity, scope: "life:read" | "life:write") {
  if (!identity.scopes.includes(scope)) throw new Error(scope === "life:read" ? "READ_SCOPE_REQUIRED" : "WRITE_SCOPE_REQUIRED");
}

function isFileReference(value: unknown): value is FileReference {
  const item = record(value);
  return typeof item.download_url === "string" && typeof item.file_id === "string";
}

function allowedOpenAiFileUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return (
      host === "oaiusercontent.com" ||
      host.endsWith(".oaiusercontent.com") ||
      host === "openai.com" ||
      host.endsWith(".openai.com") ||
      host === "chatgpt.com" ||
      host.endsWith(".chatgpt.com")
    );
  } catch {
    return false;
  }
}

async function downloadProvidedFile(file: FileReference) {
  if (!allowedOpenAiFileUrl(file.download_url)) throw new Error("UNTRUSTED_FILE_URL");
  const response = await fetch(file.download_url, {
    method: "GET",
    redirect: "error",
    headers: { Accept: "image/*" },
    cache: "no-store",
  });
  if (!response.ok || !response.body) throw new Error("FILE_DOWNLOAD_FAILED");
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MEAL_PHOTO_MAX_INPUT_BYTES) throw new Error("PHOTO_TOO_LARGE");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MEAL_PHOTO_MAX_INPUT_BYTES) {
      await reader.cancel();
      throw new Error("PHOTO_TOO_LARGE");
    }
    chunks.push(value);
  }
  const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  const contentType = file.mime_type || response.headers.get("content-type") || "application/octet-stream";
  return { buffer, contentType };
}

async function attachMealPhoto(mealId: string, file: FileReference) {
  const downloaded = await downloadProvidedFile(file);
  const compressed = await compressMealPhoto(downloaded.buffer, downloaded.contentType);
  const path = buildMealPhotoPath(mealId, compressed.extension);
  await uploadMealPhotoObject(
    path,
    compressed.bytes.buffer.slice(
      compressed.bytes.byteOffset,
      compressed.bytes.byteOffset + compressed.bytes.byteLength,
    ) as ArrayBuffer,
    compressed.contentType,
  );
  try {
    const replacement = await replaceMealPhotoPath(mealId, path);
    if (replacement.previousPhotoPath && replacement.previousPhotoPath !== path) {
      await deleteMealPhotoObject(replacement.previousPhotoPath).catch(() => undefined);
    }
    return {
      meal: replacement.meal,
      photo: {
        fileId: file.file_id,
        width: compressed.width,
        height: compressed.height,
        quality: compressed.quality,
        originalBytes: compressed.originalBytes,
        outputBytes: compressed.outputBytes,
        contentType: compressed.contentType,
      },
    };
  } catch (error) {
    await deleteMealPhotoObject(path).catch(() => undefined);
    throw error;
  }
}

async function query(domain: string, filters: Record<string, unknown>, identity: LifeMcpAccessIdentity) {
  assertScope(identity, "life:read");
  if (domain === "medicine") {
    const medicines = await listMedicines();
    const needle = text(filters.nameContains).toLowerCase();
    const data = needle ? medicines.filter((item) => item.name.toLowerCase().includes(needle)) : medicines;
    return result({ ok: true, domain, data });
  }
  if (domain === "meal") {
    const mealDate = text(filters.date || filters.mealDate);
    if (!validIsoDate(mealDate)) return errorResult("meal 查询需要 YYYY-MM-DD 格式的 date", "INVALID_DATE");
    const requested = partner(filters.partnerKey || filters.person, identity.partnerKey);
    if ((filters.partnerKey || filters.person) && requested === null) {
      if (filters.partnerKey === "all" || filters.person === "all") {
        const data = await listMeals({ mealDate, partnerKey: null });
        return result({ ok: true, domain, data });
      }
      return errorResult("partnerKey 只能是 cat、fish、me 或 all", "INVALID_PARTNER");
    }
    const data = await listMeals({ mealDate, partnerKey: requested });
    return result({ ok: true, domain, data });
  }
  if (domain === "weight") {
    const requested = partner(filters.partnerKey || filters.person, identity.partnerKey);
    if (!requested) return errorResult("partnerKey 只能是 cat、fish 或 me", "INVALID_PARTNER");
    const rawLimit = typeof filters.limit === "number" ? Math.floor(filters.limit) : 90;
    const data = await listWeights(requested, Math.max(1, Math.min(rawLimit, 365)));
    return result({ ok: true, domain, data });
  }
  if (["day", "mood", "sleep", "activity"].includes(domain)) {
    const date = text(filters.date);
    if (!validIsoDate(date)) return errorResult("该查询需要 YYYY-MM-DD 格式的 date", "INVALID_DATE");
    const day = await getLifeDay(date);
    if (domain === "mood") return result({ ok: true, domain, data: day.moods });
    if (domain === "sleep") return result({ ok: true, domain, data: day.sleeps });
    if (domain === "activity") return result({ ok: true, domain, data: day.activities });
    return result({ ok: true, domain, data: day });
  }
  return errorResult(`尚未注册查询 domain: ${domain}`, "DOMAIN_NOT_REGISTERED");
}

async function write(args: Record<string, unknown>, identity: LifeMcpAccessIdentity) {
  assertScope(identity, "life:write");
  const domain = text(args.domain);
  const action = text(args.action);
  if (args.confirmed !== true) return errorResult("当前对话没有明确确认写入", "CONFIRMATION_REQUIRED");
  const idempotencyKey = text(args.idempotencyKey);
  if (!isChatgptWriteIdempotencyKey(idempotencyKey, domain as "meal" | "mood" | "sleep" | "activity" | "weight" | "medicine")) {
    return errorResult("幂等键必须使用 chatgpt:<domain>: 前缀", "INVALID_IDEMPOTENCY_KEY");
  }
  const payload = record(args.payload);

  if (domain === "meal" && action === "create") {
    const prepared = prepareConfirmedChatgptMeal(
      { ...payload, partnerKey: identity.partnerKey },
      idempotencyKey,
    );
    if (!prepared.ok) return errorResult(prepared.reason, "INVALID_MEAL");
    let meal = await createChatgptMeal(prepared.value, idempotencyKey);
    let photo: Record<string, unknown> | null = null;
    if (args.file != null) {
      if (!isFileReference(args.file)) return errorResult("照片文件引用格式不正确", "INVALID_FILE_REFERENCE");
      const attached = await attachMealPhoto(meal.id, args.file);
      meal = attached.meal;
      photo = attached.photo;
    }
    return result({ ok: true, domain, action, record: meal, ...(photo ? { photo } : {}) });
  }

  if (domain === "mood" && (action === "create" || action === "upsert")) {
    const parsed = parseMoodWritePayload({
      ...payload,
      partnerKey: identity.partnerKey,
      source: "chatgpt",
      idempotencyKey,
    });
    if (!parsed.ok) return errorResult(parsed.reason, "INVALID_MOOD");
    const saved = await upsertMood(parsed.value);
    return result({ ok: true, domain, action: "upsert", record: saved });
  }

  if (domain === "sleep" && (action === "create" || action === "upsert")) {
    const parsed = parseSleepWritePayload({
      ...payload,
      partnerKey: identity.partnerKey,
      source: "chatgpt",
      idempotencyKey,
    });
    if (!parsed.ok) return errorResult(parsed.reason, "INVALID_SLEEP");
    const saved = await upsertSleep(parsed.value);
    return result({ ok: true, domain, action: "upsert", record: saved });
  }

  if (domain === "activity" && action === "create") {
    const parsed = parseActivityWritePayload({
      ...payload,
      source: "chatgpt",
      idempotencyKey,
    });
    if (!parsed.ok) return errorResult(parsed.reason, "INVALID_ACTIVITY");
    const saved = await createActivity(parsed.value);
    return result({ ok: true, domain, action, record: saved });
  }

  return errorResult(`尚未注册写入操作: ${domain}.${action}`, "WRITE_NOT_REGISTERED");
}

export async function callLifeMcpTool(
  name: string,
  rawArguments: unknown,
  identity: LifeMcpAccessIdentity,
): Promise<ToolResult> {
  try {
    const args = record(rawArguments);
    if (name === "life_capabilities") {
      assertScope(identity, "life:read");
      return result({
        ok: true,
        stableTools: ["life_capabilities", "life_query", "life_write"],
        domains: {
          medicine: { read: ["list"], write: [] },
          meal: { read: ["list"], write: ["create"], fileUpload: true },
          weight: { read: ["list"], write: [] },
          day: { read: ["get"], write: [] },
          mood: { read: ["get-by-day"], write: ["upsert"] },
          sleep: { read: ["get-by-day"], write: ["upsert"] },
          activity: { read: ["get-by-day"], write: ["create"] },
        },
        extensionModel:
          "New domains are registered behind life_query/life_write. Existing ChatGPT app configuration and MCP URL stay unchanged.",
      });
    }
    if (name === "life_query") return query(text(args.domain), record(args.filters), identity);
    if (name === "life_write") return write(args, identity);
    return errorResult(`未知工具: ${name}`, "TOOL_NOT_FOUND");
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return errorResult(message, "TOOL_EXECUTION_FAILED");
  }
}
