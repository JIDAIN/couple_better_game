import { LifeClarificationError } from "@/lib/ai/life-input-normalizer";
import { compressMealPhoto, MEAL_PHOTO_MAX_INPUT_BYTES } from "@/lib/server/image-compression";
import type { FixedLifeIdentity } from "@/lib/server/fixed-life-auth";
import type { LifeMcpAccessIdentity } from "@/lib/server/life-mcp-auth";
import { createLifeMediaRecovery } from "@/lib/server/life-mcp-media-recovery";
import {
  executeLifeAgentTool,
  LIFE_AGENT_TOOLS,
  type LifeAgentAttachment,
} from "@/lib/server/life-agent-executor";

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

type InlineImageReference = {
  data_base64: string;
  mime_type: string;
  file_name?: string;
};

type CallOptions = {
  toolCallId?: string;
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

const INLINE_IMAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    data_base64: {
      type: "string",
      description: "图片原始字节的 base64（不要包含 data: 前缀）",
    },
    mime_type: {
      type: "string",
      description: "图片 MIME，例如 image/jpeg、image/png、image/webp",
    },
    file_name: { type: "string" },
  },
  required: ["data_base64", "mime_type"],
};

const MEDIA_REFERENCE_SCHEMA = {
  description:
    "跨 MCP 客户端的图片输入。客户端能读取聊天附件字节时可使用 inline base64；OpenAI/ChatGPT 文件绑定继续优先使用 file。",
  oneOf: [INLINE_IMAGE_SCHEMA],
};

const LIFE_MUTATE_MEDIA_ORCHESTRATION =
  "图片编排规则：当用户明确要求把当前聊天图片识别或保存到 meal 时，图片不可见也必须调用一次 life_mutate，并设置 attachPhoto=true。即使模型只看到 [Image]、OCR 失败、格式不支持提示，或没有 file/media 字节，也不要在调用工具前自行拒绝，不要要求用户重新上传 PNG/JPG。data 只填写能够从用户文字、现有记录或视觉结果中安全确定的业务信息，不要编造食物。若客户端没有透传原图，服务端会返回 MEDIA_ATTACHMENT_REQUIRED 和 recovery.uploadUrl；收到 MEDIA_ATTACHMENT_REQUIRED 后不要再次调用 life_mutate、不要重复 create/update/attachPhoto，只把 recovery.uploadUrl 直接交给用户补传原图。";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function identityOf(identity: LifeMcpAccessIdentity): FixedLifeIdentity {
  return {
    partnerKey: identity.partnerKey,
    displayName: identity.partnerKey === "cat" ? "猫猫" : "鱼鱼",
  };
}

function assertScope(identity: LifeMcpAccessIdentity, scope: "life:read" | "life:write") {
  if (!identity.scopes.includes(scope)) {
    throw new Error(scope === "life:read" ? "READ_SCOPE_REQUIRED" : "WRITE_SCOPE_REQUIRED");
  }
}

function successResult(value: unknown): ToolResult {
  const structuredContent = Array.isArray(value)
    ? { ok: true, result: value }
    : value && typeof value === "object"
      ? { ok: true, ...(value as Record<string, unknown>) }
      : { ok: true, result: value };
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}

function errorResult(
  message: string,
  code: string,
  extra: Record<string, unknown> = {},
): ToolResult {
  const structuredContent = { ok: false, error: message, errorCode: code, ...extra };
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent) }],
    structuredContent,
    isError: true,
  };
}

function clarificationResult(error: LifeClarificationError): ToolResult {
  const structuredContent = {
    ok: false,
    errorCode: error.code,
    clarification: {
      question: error.question,
      missing: error.missing,
    },
  };
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}

function isFileReference(value: unknown): value is FileReference {
  const item = record(value);
  return typeof item.download_url === "string" && typeof item.file_id === "string";
}

function isInlineImageReference(value: unknown): value is InlineImageReference {
  const item = record(value);
  return typeof item.data_base64 === "string" && typeof item.mime_type === "string";
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

  return {
    buffer: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
    contentType: file.mime_type || response.headers.get("content-type") || "application/octet-stream",
  };
}

function decodeInlineImage(media: InlineImageReference) {
  const mimeType = media.mime_type.trim().toLowerCase();
  if (!mimeType.startsWith("image/")) throw new Error("INVALID_IMAGE_MIME_TYPE");
  const encoded = media.data_base64.replace(/\s+/g, "");
  if (!encoded || !/^[a-z0-9+/]*={0,2}$/i.test(encoded) || encoded.length % 4 !== 0) {
    throw new Error("INVALID_IMAGE_BASE64");
  }
  const buffer = Buffer.from(encoded, "base64");
  if (!buffer.byteLength) throw new Error("INVALID_IMAGE_BASE64");
  if (buffer.byteLength > MEAL_PHOTO_MAX_INPUT_BYTES) throw new Error("PHOTO_TOO_LARGE");
  return { buffer, contentType: mimeType };
}

async function compressAttachment(buffer: Buffer, contentType: string): Promise<LifeAgentAttachment> {
  const compressed = await compressMealPhoto(buffer, contentType);
  return {
    bytes: compressed.bytes,
    contentType: "image/webp",
    extension: "webp",
    width: compressed.width,
    height: compressed.height,
    outputBytes: compressed.outputBytes,
  };
}

async function prepareFileAttachment(file: FileReference): Promise<LifeAgentAttachment> {
  const downloaded = await downloadProvidedFile(file);
  return compressAttachment(downloaded.buffer, downloaded.contentType);
}

async function prepareInlineAttachment(media: InlineImageReference): Promise<LifeAgentAttachment> {
  const decoded = decodeInlineImage(media);
  return compressAttachment(decoded.buffer, decoded.contentType);
}

function photoRequested(args: Record<string, unknown>) {
  return args.attachPhoto === true;
}

function mcpToolDefinition(tool: (typeof LIFE_AGENT_TOOLS)[number]): LifeMcpToolDefinition {
  const name = tool.function.name;
  const parameters = record(tool.function.parameters);
  const baseProperties = record(parameters.properties);
  const properties: Record<string, unknown> = {
    ...baseProperties,
    userText: {
      type: "string",
      description:
        name === "life_mutate"
          ? "当前触发本次写入的用户原始消息。删除和高风险操作必须原样提供，用于服务端安全校验。"
          : "可选。当前用户原始消息，用于今天/昨天等自然时间归一化。",
    },
  };

  if (name === "life_mutate") {
    properties.attachPhoto = {
      type: "boolean",
      description:
        "meal 是否必须保存本轮原图。只有本次调用实际携带 file 或 media 图片时才能直接完成；如果客户端只给了 [Image]/OCR 文本占位而没有图片字节，也可以设为 true，服务端会返回一次性 browser_upload 恢复链接。收到 MEDIA_ATTACHMENT_REQUIRED 后不要重复 create/update，也不要再试 attachPhoto；只把 recovery.uploadUrl 交给用户补传原图。",
    };
    properties.file = FILE_REFERENCE_SCHEMA;
    properties.media = MEDIA_REFERENCE_SCHEMA;
  }

  const required = Array.isArray(parameters.required)
    ? parameters.required.filter((value): value is string => typeof value === "string")
    : [];
  if (name === "life_mutate" && !required.includes("userText")) required.push("userText");

  return {
    name,
    title:
      name === "life_query"
        ? "查询生活记录"
        : name === "life_mutate"
          ? "修改生活记录"
          : "查看生活记录能力",
    description:
      name === "life_mutate"
        ? `${tool.function.description} ${LIFE_MUTATE_MEDIA_ORCHESTRATION}`
        : tool.function.description,
    inputSchema: {
      ...parameters,
      properties,
      required,
    },
    annotations: {
      readOnlyHint: name !== "life_mutate",
      destructiveHint: name === "life_mutate",
      idempotentHint: name !== "life_mutate",
      openWorldHint: false,
    },
    ...(name === "life_mutate"
      ? {
          _meta: {
            "openai/fileParams": ["file"],
            "openai/toolInvocation/invoking": "正在更新生活记录…",
            "openai/toolInvocation/invoked": "生活记录已处理",
          },
        }
      : {}),
  };
}

export const LIFE_MCP_TOOLS: LifeMcpToolDefinition[] = LIFE_AGENT_TOOLS.map(mcpToolDefinition);

export async function callLifeMcpTool(
  name: string,
  rawArguments: unknown,
  identity: LifeMcpAccessIdentity,
  options: CallOptions = {},
): Promise<ToolResult> {
  try {
    if (!LIFE_MCP_TOOLS.some((tool) => tool.name === name)) {
      return errorResult(`未知工具: ${name}`, "TOOL_NOT_FOUND");
    }

    if (name === "life_mutate") assertScope(identity, "life:write");
    else assertScope(identity, "life:read");

    const args = record(rawArguments);
    const latestUserText = text(args.userText);
    if (name === "life_mutate" && !latestUserText) {
      return errorResult("life_mutate 必须提供当前用户原始消息 userText", "USER_TEXT_REQUIRED");
    }

    if (args.file != null && args.media != null) {
      return errorResult("一次调用只能提供一种图片附件来源", "MULTIPLE_MEDIA_INPUTS");
    }

    let attachment: LifeAgentAttachment | null = null;
    if (args.file != null) {
      if (name !== "life_mutate") return errorResult("只有 life_mutate 支持文件附件", "FILE_NOT_ALLOWED");
      if (!isFileReference(args.file)) return errorResult("照片文件引用格式不正确", "INVALID_FILE_REFERENCE");
      attachment = await prepareFileAttachment(args.file);
    } else if (args.media != null) {
      if (name !== "life_mutate") return errorResult("只有 life_mutate 支持媒体附件", "MEDIA_NOT_ALLOWED");
      if (!isInlineImageReference(args.media)) {
        return errorResult("图片媒体引用格式不正确", "INVALID_MEDIA_REFERENCE");
      }
      attachment = await prepareInlineAttachment(args.media);
    }

    if (name === "life_mutate" && photoRequested(args) && !attachment) {
      const recoveryArgs = { ...args };
      delete recoveryArgs.userText;
      delete recoveryArgs.file;
      delete recoveryArgs.media;
      recoveryArgs.attachPhoto = true;
      const recovery = createLifeMediaRecovery({
        partnerKey: identity.partnerKey,
        args: recoveryArgs,
        userText: latestUserText,
        toolCallId: options.toolCallId,
      });
      return errorResult(
        "用户要求保存本轮图片，但当前 MCP 客户端没有透传原图字节。本次业务写入尚未执行。不要重复 create/update，也不要再次尝试 attachPhoto。请把 recovery.uploadUrl 直接提供给用户；用户在浏览器补传同一张照片后，服务端会使用本次已签名的身份和业务参数继续完成原操作。",
        "MEDIA_ATTACHMENT_REQUIRED",
        {
          retryable: false,
          mutationExecuted: false,
          recovery: {
            type: "browser_upload",
            uploadUrl: recovery.uploadUrl,
            expiresInSeconds: recovery.expiresInSeconds,
          },
        },
      );
    }

    const forwarded = { ...args };
    delete forwarded.userText;
    delete forwarded.file;
    delete forwarded.media;
    if (attachment && name === "life_mutate") forwarded.attachPhoto = true;

    const value = await executeLifeAgentTool(name, forwarded, {
      identity: identityOf(identity),
      latestUserText,
      attachment,
      toolCallId: options.toolCallId,
    });
    return successResult(value);
  } catch (error) {
    if (error instanceof LifeClarificationError) return clarificationResult(error);
    const message = error instanceof Error ? error.message : "未知错误";
    return errorResult(message, "TOOL_EXECUTION_FAILED");
  }
}
