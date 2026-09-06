import { LifeClarificationError } from "@/lib/ai/life-input-normalizer";
import { compressMealPhoto, MEAL_PHOTO_MAX_INPUT_BYTES } from "@/lib/server/image-compression";
import type { FixedLifeIdentity } from "@/lib/server/fixed-life-auth";
import type { LifeMcpAccessIdentity } from "@/lib/server/life-mcp-auth";
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

function errorResult(message: string, code: string): ToolResult {
  const structuredContent = { ok: false, error: message, errorCode: code };
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

async function prepareAttachment(file: FileReference): Promise<LifeAgentAttachment> {
  const downloaded = await downloadProvidedFile(file);
  const compressed = await compressMealPhoto(downloaded.buffer, downloaded.contentType);
  return {
    bytes: compressed.bytes,
    contentType: "image/webp",
    extension: "webp",
    width: compressed.width,
    height: compressed.height,
    outputBytes: compressed.outputBytes,
  };
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
    properties.file = FILE_REFERENCE_SCHEMA;
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
    description: tool.function.description,
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

    let attachment: LifeAgentAttachment | null = null;
    if (args.file != null) {
      if (name !== "life_mutate") return errorResult("只有 life_mutate 支持文件附件", "FILE_NOT_ALLOWED");
      if (!isFileReference(args.file)) return errorResult("照片文件引用格式不正确", "INVALID_FILE_REFERENCE");
      attachment = await prepareAttachment(args.file);
    }

    const forwarded = { ...args };
    delete forwarded.userText;
    delete forwarded.file;
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
