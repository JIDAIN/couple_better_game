import type { FixedLifeIdentity } from "./fixed-life-auth";
import {
  executeLifeAgentTool,
  LIFE_AGENT_TOOLS,
  type LifeAgentAttachment,
} from "./life-agent-registry";

const AI_GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";
const MAX_TOOL_ROUNDS = 8;
const MAX_HISTORY_MESSAGES = 12;

type ClientHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type TextContent = { type: "text"; text: string };
type ImageContent = { type: "image_url"; image_url: { url: string } };
type UserContent = string | Array<TextContent | ImageContent>;

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type GatewayMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: UserContent }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type GatewayResponse = {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: ToolCall[];
    };
  }>;
  error?: { message?: string; code?: string };
};

export type LifeAiOperation = {
  tool: string;
  ok: boolean;
  summary: string;
};

export type LifeAiResult = {
  text: string;
  model: string;
  operations: LifeAiOperation[];
};

export class LifeAiGatewayError extends Error {
  constructor(
    message: string,
    public readonly code: "AI_NOT_CONFIGURED" | "AI_GATEWAY_FAILED" | "AI_BAD_RESPONSE",
  ) {
    super(message);
  }
}

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function gatewayCredential() {
  return env("AI_GATEWAY_API_KEY") || env("VERCEL_OIDC_TOKEN");
}

function modelName() {
  return env("LIFE_AI_MODEL") || DEFAULT_MODEL;
}

function appTimeZone() {
  return env("LIFE_TIME_ZONE") || "Asia/Shanghai";
}

function currentDateInAppTimeZone() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: appTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function otherPartnerKey(key: "cat" | "fish") {
  return key === "cat" ? "fish" : "cat";
}

function systemPrompt(identity: FixedLifeIdentity) {
  return [
    "你是‘岛屿生活’程序内置 AI 助手，不是旁观者。你的任务是帮助当前登录用户查询和维护程序里的真实数据。",
    `当前登录身份：${identity.displayName} (${identity.partnerKey})；Ta = ${otherPartnerKey(identity.partnerKey)}。`,
    `程序日期：${currentDateInAppTimeZone()}；时区：${appTimeZone()}。`,
    "规则：",
    "1. 只要问题涉及程序中已有的事实、记录、数量、日期或状态，就必须先调用 life_query；不要凭聊天上下文猜数据库事实。",
    "2. 用户明确要求记录、新增、修改时，直接调用 life_mutate 完成，不要只告诉用户怎么操作。成功后再简洁说明已经改了什么。",
    "3. 个人记录的身份由服务端强制绑定当前账号；不要尝试替 Ta 写个人数据。共享药箱可以正常维护。信件只能以当前用户为寄件人。",
    "4. update/delete 前如果缺少记录 ID，先查询找到正确记录；不要编造 UUID。",
    "5. 删除只有用户当前消息明确表达删除意图时才执行。旧 /game 的完整快照覆盖只有用户当前消息包含‘确认覆盖游戏数据’时才能执行。",
    "6. 用户上传餐食照片时，你可以识别图片中的食物并估算合理的食物名称、份量和热量区间；如果用户要求保存，meal create/update 时设置 attachPhoto=true，把同一张图片保存到餐食记录。不要声称精确识别不可见的重量。",
    "7. 用户只是询问或讨论时不要写数据库。用户说‘记一下/改成/帮我添加/删掉’等明确动作时才写。",
    "8. life_export 和 legacy_home 数据可能很大，只在跨域全局问题确实需要时查询；普通问题优先查询最小必要资源。",
    "9. 工具返回失败时，如实解释，不得声称已经保存成功。",
    "10. 回复使用简洁自然的中文。",
  ].join("\n");
}

function sanitizeHistory(history: unknown): ClientHistoryMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item): item is ClientHistoryMessage => {
      if (!item || typeof item !== "object") return false;
      const record = item as Record<string, unknown>;
      return (
        (record.role === "user" || record.role === "assistant") &&
        typeof record.content === "string" &&
        record.content.trim().length > 0
      );
    })
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({ role: item.role, content: item.content.slice(0, 8000) }));
}

function attachmentDataUrl(attachment: LifeAgentAttachment) {
  return `data:${attachment.contentType};base64,${attachment.bytes.toString("base64")}`;
}

function parseToolArguments(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function summarizeTool(name: string, args: Record<string, unknown>) {
  const resource = typeof args.resource === "string" ? args.resource : "";
  const action = typeof args.action === "string" ? args.action : "";
  if (name === "life_query") return `查询 ${resource || "生活数据"}`;
  if (name === "life_mutate") return `${action || "修改"} ${resource || "生活数据"}`;
  return "读取 AI 能力";
}

async function callGateway(messages: GatewayMessage[], model: string) {
  const credential = gatewayCredential();
  if (!credential) {
    throw new LifeAiGatewayError(
      "Vercel AI Gateway 尚未可用：没有 AI_GATEWAY_API_KEY 或 VERCEL_OIDC_TOKEN",
      "AI_NOT_CONFIGURED",
    );
  }

  let response: Response;
  try {
    response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credential}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        tools: LIFE_AGENT_TOOLS,
        tool_choice: "auto",
        temperature: 0.2,
      }),
      cache: "no-store",
    });
  } catch {
    throw new LifeAiGatewayError("连接 AI Gateway 失败", "AI_GATEWAY_FAILED");
  }

  const body = (await response.json().catch(() => null)) as GatewayResponse | null;
  if (!response.ok) {
    const detail = body?.error?.message?.trim();
    throw new LifeAiGatewayError(detail || `AI Gateway 返回 ${response.status}`, "AI_GATEWAY_FAILED");
  }
  const message = body?.choices?.[0]?.message;
  if (!message) throw new LifeAiGatewayError("AI Gateway 没有返回有效消息", "AI_BAD_RESPONSE");
  return message;
}

export async function runLifeAiAgent({
  identity,
  message,
  history,
  attachment,
}: {
  identity: FixedLifeIdentity;
  message: string;
  history?: unknown;
  attachment?: LifeAgentAttachment | null;
}): Promise<LifeAiResult> {
  const text = message.trim();
  if (!text && !attachment) {
    throw new LifeAiGatewayError("请输入消息或选择一张图片", "AI_BAD_RESPONSE");
  }

  const model = modelName();
  const messages: GatewayMessage[] = [
    { role: "system", content: systemPrompt(identity) },
    ...sanitizeHistory(history).map((item): GatewayMessage => ({ role: item.role, content: item.content })),
  ];

  const userParts: Array<TextContent | ImageContent> = [];
  if (text) userParts.push({ type: "text", text });
  if (attachment) userParts.push({ type: "image_url", image_url: { url: attachmentDataUrl(attachment) } });
  messages.push({ role: "user", content: userParts.length === 1 && userParts[0]?.type === "text" ? userParts[0].text : userParts });

  const operations: LifeAiOperation[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const assistant = await callGateway(messages, model);
    const toolCalls = Array.isArray(assistant.tool_calls) ? assistant.tool_calls : [];
    messages.push({
      role: "assistant",
      content: typeof assistant.content === "string" ? assistant.content : null,
      ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
    });

    if (toolCalls.length === 0) {
      const finalText = typeof assistant.content === "string" ? assistant.content.trim() : "";
      return {
        text: finalText || "已完成。",
        model,
        operations,
      };
    }

    for (const call of toolCalls) {
      const args = parseToolArguments(call.function.arguments);
      const summary = summarizeTool(call.function.name, args);
      try {
        const result = await executeLifeAgentTool(call.function.name, args, {
          identity,
          latestUserText: text,
          attachment,
          toolCallId: call.id,
        });
        operations.push({ tool: call.function.name, ok: true, summary });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ ok: true, result }),
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "工具执行失败";
        operations.push({ tool: call.function.name, ok: false, summary: `${summary}：${reason}` });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ ok: false, error: reason }),
        });
      }
    }
  }

  throw new LifeAiGatewayError("AI 连续调用工具次数过多，请把任务拆成更小的一步再试", "AI_BAD_RESPONSE");
}
