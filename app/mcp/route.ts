import { LIFE_MCP_TOOLS, callLifeMcpTool } from "@/lib/server/life-mcp-tools";
import { resolveAccessToken } from "@/lib/server/life-mcp-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;

type JsonRpcRequest = {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

function originOf(request: Request) {
  return new URL(request.url).origin;
}

function resourceOf(request: Request) {
  return `${originOf(request)}/mcp`;
}

function metadataUrl(request: Request) {
  return `${originOf(request)}/.well-known/oauth-protected-resource`;
}

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function rpcResult(id: unknown, result: unknown) {
  return json({ jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(id: unknown, code: number, message: string, status = 200) {
  return json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, status);
}

function unauthorized(request: Request) {
  return json(
    { error: "unauthorized", error_description: "OAuth access token required" },
    401,
    {
      "WWW-Authenticate": `Bearer resource_metadata="${metadataUrl(request)}", scope="life:read life:write"`,
    },
  );
}

function allowedOrigin(request: Request) {
  const raw = request.headers.get("origin");
  if (!raw) return true;
  try {
    const origin = new URL(raw);
    if (origin.origin === originOf(request)) return true;
    const host = origin.hostname.toLowerCase();
    return (
      origin.protocol === "https:" &&
      (host === "chatgpt.com" ||
        host.endsWith(".chatgpt.com") ||
        host === "openai.com" ||
        host.endsWith(".openai.com"))
    );
  } catch {
    return false;
  }
}

function resolveProtocol(request: Request, params: Record<string, unknown>) {
  const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
  if (SUPPORTED_PROTOCOLS.includes(requested as (typeof SUPPORTED_PROTOCOLS)[number])) return requested;
  const header = request.headers.get("mcp-protocol-version") ?? "";
  if (SUPPORTED_PROTOCOLS.includes(header as (typeof SUPPORTED_PROTOCOLS)[number])) return header;
  return SUPPORTED_PROTOCOLS[0];
}

export async function OPTIONS(request: Request) {
  if (!allowedOrigin(request)) return new Response(null, { status: 403 });
  const requestOrigin = request.headers.get("origin") ?? "";
  return new Response(null, {
    status: 204,
    headers: {
      ...(requestOrigin ? { "Access-Control-Allow-Origin": requestOrigin, Vary: "Origin" } : {}),
      "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}

export async function GET(request: Request) {
  if (!allowedOrigin(request)) return rpcError(null, -32000, "Invalid Origin", 403);
  const identity = resolveAccessToken(request, resourceOf(request));
  if (!identity) return unauthorized(request);
  return new Response(null, {
    status: 405,
    headers: { Allow: "POST", "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return rpcError(null, -32000, "Invalid Origin", 403);
  const identity = resolveAccessToken(request, resourceOf(request));
  if (!identity) return unauthorized(request);

  let message: JsonRpcRequest;
  try {
    message = (await request.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(message.id, -32600, "Invalid Request", 400);
  }

  const isNotification = message.id === undefined;
  if (isNotification) {
    return new Response(null, { status: 202, headers: { "Cache-Control": "no-store" } });
  }

  if (message.method === "initialize") {
    const params =
      typeof message.params === "object" && message.params !== null && !Array.isArray(message.params)
        ? (message.params as Record<string, unknown>)
        : {};
    return rpcResult(message.id, {
      protocolVersion: resolveProtocol(request, params),
      capabilities: { tools: { listChanged: false } },
      serverInfo: {
        name: "couple-better-game-life",
        title: "🐟🐱生活记录",
        version: "1.0.0",
        description: "Private couple life records with OAuth, stable domain routing, and confirmed writes.",
      },
      instructions:
        "Use life_query for fresh records. Before any write, confirm the user explicitly wants the change saved. Personal writes are always bound to the OAuth identity. Use the optional file parameter on life_write for a user-provided meal photo.",
    });
  }

  if (message.method === "ping") return rpcResult(message.id, {});
  if (message.method === "tools/list") return rpcResult(message.id, { tools: LIFE_MCP_TOOLS });
  if (message.method === "tools/call") {
    const params =
      typeof message.params === "object" && message.params !== null && !Array.isArray(message.params)
        ? (message.params as Record<string, unknown>)
        : {};
    const name = typeof params.name === "string" ? params.name : "";
    if (!name) return rpcError(message.id, -32602, "Tool name is required");
    const tool = LIFE_MCP_TOOLS.find((item) => item.name === name);
    if (!tool) return rpcError(message.id, -32602, `Unknown tool: ${name}`);
    const result = await callLifeMcpTool(name, params.arguments, identity);
    return rpcResult(message.id, result);
  }

  return rpcError(message.id, -32601, `Method not found: ${message.method}`);
}
