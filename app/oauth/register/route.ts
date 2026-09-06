import { createRegisteredClient } from "@/lib/server/life-mcp-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RegistrationRequest = {
  redirect_uris?: unknown;
  client_name?: unknown;
  token_endpoint_auth_method?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
  scope?: unknown;
};

function noStoreJson(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function describeRedirectUris(values: unknown) {
  if (!Array.isArray(values)) return [{ kind: "not_array" }];
  return values.slice(0, 10).map((value) => {
    if (typeof value !== "string") return { kind: typeof value };
    try {
      const url = new URL(value);
      return {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || null,
        pathname: url.pathname,
      };
    } catch {
      return { kind: "invalid_url" };
    }
  });
}

function registrationFailure(error: unknown, redirectUris?: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN_REGISTRATION_ERROR";
  console.error("MCP_CLIENT_REGISTRATION_FAILED", {
    code,
    redirectUris: describeRedirectUris(redirectUris),
  });

  if (code === "LIFE_MCP_SIGNING_SECRET_MISSING") {
    return noStoreJson(
      {
        error: "server_error",
        error_description: "OAuth signing configuration is unavailable",
      },
      503,
    );
  }

  if (code === "INVALID_REDIRECT_URIS") {
    return noStoreJson(
      {
        error: "invalid_redirect_uri",
        error_description: "Only HTTPS or loopback HTTP redirect URIs are supported",
      },
      400,
    );
  }

  return noStoreJson({ error: "invalid_client_metadata" }, 400);
}

export async function POST(request: Request) {
  let body: RegistrationRequest;
  try {
    body = (await request.json()) as RegistrationRequest;
  } catch {
    return noStoreJson({ error: "invalid_client_metadata" }, 400);
  }

  if (!Array.isArray(body.redirect_uris) || !body.redirect_uris.every((value) => typeof value === "string")) {
    console.error("MCP_CLIENT_REGISTRATION_INVALID_REDIRECT_SHAPE", {
      redirectUris: describeRedirectUris(body.redirect_uris),
    });
    return noStoreJson({ error: "invalid_redirect_uri" }, 400);
  }

  if (body.token_endpoint_auth_method != null && body.token_endpoint_auth_method !== "none") {
    return noStoreJson(
      { error: "invalid_client_metadata", error_description: "Only public PKCE clients are supported" },
      400,
    );
  }

  try {
    const redirectUris = body.redirect_uris as string[];
    const clientName = typeof body.client_name === "string" ? body.client_name : null;
    const clientId = createRegisteredClient({ redirectUris, clientName });
    return noStoreJson(
      {
        client_id: clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        redirect_uris: redirectUris,
        client_name: clientName ?? "ChatGPT MCP client",
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      },
      201,
    );
  } catch (error) {
    return registrationFailure(error, body.redirect_uris);
  }
}
