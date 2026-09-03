import {
  issueMcpTokens,
  markAuthorizationCodeRedeemed,
  resolveAuthorizationCode,
  resolveRefreshToken,
  resolveRegisteredClient,
  verifyPkce,
} from "@/lib/server/life-mcp-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });
}

function oauthError(error: string, description: string, status = 400) {
  return response({ error, error_description: description }, status);
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return oauthError("invalid_request", "Token request must be form encoded");
  }

  const grantType = String(form.get("grant_type") ?? "").trim();
  const resource = String(form.get("resource") ?? "").trim();
  const expectedResource = `${new URL(request.url).origin}/mcp`;
  if (resource !== expectedResource) {
    return oauthError("invalid_target", "resource must match the MCP endpoint");
  }

  if (grantType === "authorization_code") {
    const code = String(form.get("code") ?? "").trim();
    const clientId = String(form.get("client_id") ?? "").trim();
    const redirectUri = String(form.get("redirect_uri") ?? "").trim();
    const codeVerifier = String(form.get("code_verifier") ?? "");
    if (!code || !clientId || !redirectUri || !codeVerifier) {
      return oauthError("invalid_request", "Missing authorization_code parameters");
    }

    const client = resolveRegisteredClient(clientId);
    const authorizationCode = resolveAuthorizationCode(code);
    if (
      !client ||
      !client.redirectUris.includes(redirectUri) ||
      !authorizationCode ||
      authorizationCode.clientId !== clientId ||
      authorizationCode.redirectUri !== redirectUri ||
      authorizationCode.resource !== resource ||
      !verifyPkce(codeVerifier, authorizationCode.codeChallenge)
    ) {
      return oauthError("invalid_grant", "Authorization code is invalid, expired, or PKCE verification failed");
    }

    try {
      const firstRedemption = await markAuthorizationCodeRedeemed(code);
      if (!firstRedemption) {
        return oauthError("invalid_grant", "Authorization code has already been used");
      }
    } catch {
      return oauthError("temporarily_unavailable", "Unable to persist authorization code redemption", 503);
    }

    const tokens = issueMcpTokens({
      partnerKey: authorizationCode.partnerKey,
      resource,
      scope: authorizationCode.scope,
    });
    return response({
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: authorizationCode.scope.join(" "),
    });
  }

  if (grantType === "refresh_token") {
    const refreshToken = String(form.get("refresh_token") ?? "").trim();
    if (!refreshToken) return oauthError("invalid_request", "refresh_token is required");
    const current = resolveRefreshToken(refreshToken, resource);
    if (!current) return oauthError("invalid_grant", "Refresh token is invalid or expired");
    const tokens = issueMcpTokens({
      partnerKey: current.partnerKey,
      resource,
      scope: current.scope,
    });
    return response({
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: current.scope.join(" "),
    });
  }

  return oauthError("unsupported_grant_type", "Only authorization_code and refresh_token are supported");
}
