import { createRegisteredClient } from "@/lib/server/life-mcp-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RegistrationRequest = {
  redirect_uris?: unknown;
  client_name?: unknown;
  token_endpoint_auth_method?: unknown;
};

export async function POST(request: Request) {
  let body: RegistrationRequest;
  try {
    body = (await request.json()) as RegistrationRequest;
  } catch {
    return Response.json({ error: "invalid_client_metadata" }, { status: 400 });
  }
  if (!Array.isArray(body.redirect_uris) || !body.redirect_uris.every((value) => typeof value === "string")) {
    return Response.json({ error: "invalid_redirect_uri" }, { status: 400 });
  }
  if (body.token_endpoint_auth_method != null && body.token_endpoint_auth_method !== "none") {
    return Response.json(
      { error: "invalid_client_metadata", error_description: "Only public PKCE clients are supported" },
      { status: 400 },
    );
  }
  try {
    const redirectUris = body.redirect_uris as string[];
    const clientName = typeof body.client_name === "string" ? body.client_name : null;
    const clientId = createRegisteredClient({ redirectUris, clientName });
    return Response.json(
      {
        client_id: clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        redirect_uris: redirectUris,
        client_name: clientName ?? "ChatGPT MCP client",
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "invalid_client_metadata" }, { status: 400 });
  }
}
