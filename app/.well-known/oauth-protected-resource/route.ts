import { LIFE_MCP_SCOPES } from "@/lib/server/life-mcp-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return Response.json(
    {
      resource: `${origin}/mcp`,
      authorization_servers: [origin],
      scopes_supported: LIFE_MCP_SCOPES,
      bearer_methods_supported: ["header"],
      resource_name: "🐟🐱生活记录",
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
