import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createAuthorizationCode,
  createRegisteredClient,
  issueMcpTokens,
  normalizeScopes,
  resolveAccessToken,
  resolveAuthorizationCode,
  resolveRefreshToken,
  resolveRegisteredClient,
  verifyPkce,
} from "../../lib/server/life-mcp-auth";

const RESOURCE = "https://couple-better-game.vercel.app/mcp";
const REDIRECT = "https://chatgpt.com/connector_platform_oauth_redirect";
const RIKKAHUB_REDIRECT = "http://127.0.0.1:52134/oauth/callback";
const VERIFIER = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~abc";

let previousSecret: string | undefined;

beforeEach(() => {
  previousSecret = process.env.LIFE_MCP_SIGNING_SECRET;
  process.env.LIFE_MCP_SIGNING_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
});

afterEach(() => {
  if (previousSecret === undefined) delete process.env.LIFE_MCP_SIGNING_SECRET;
  else process.env.LIFE_MCP_SIGNING_SECRET = previousSecret;
});

describe("life MCP OAuth helpers", () => {
  it("registers a signed public client and preserves redirect URIs", () => {
    const clientId = createRegisteredClient({ redirectUris: [REDIRECT], clientName: "ChatGPT" });
    const client = resolveRegisteredClient(clientId);
    expect(client?.redirectUris).toEqual([REDIRECT]);
    expect(client?.clientName).toBe("ChatGPT");
  });

  it("accepts RikkaHub's native loopback callback", () => {
    const clientId = createRegisteredClient({ redirectUris: [RIKKAHUB_REDIRECT], clientName: "RikkaHub" });
    expect(resolveRegisteredClient(clientId)?.redirectUris).toEqual([RIKKAHUB_REDIRECT]);
  });

  it("accepts RFC8252 loopback variants and private-use app schemes", () => {
    const redirects = [
      "http://127.0.0.42:52134/oauth/callback",
      "http://[::1]:52134/oauth/callback",
      "rikkahub://oauth/callback",
    ];
    const clientId = createRegisteredClient({ redirectUris: redirects, clientName: "Native MCP client" });
    expect(resolveRegisteredClient(clientId)?.redirectUris).toEqual(redirects);
  });

  it("rejects remote plaintext HTTP and unsafe schemes", () => {
    for (const redirectUri of [
      "http://example.com/oauth/callback",
      "http://192.168.1.2/oauth/callback",
      "file:///tmp/oauth",
      "javascript:alert(1)",
      "data:text/plain,oauth",
    ]) {
      expect(() => createRegisteredClient({ redirectUris: [redirectUri], clientName: "unsafe" })).toThrow(
        "INVALID_REDIRECT_URIS",
      );
    }
  });

  it("rejects tampered client identifiers", () => {
    const clientId = createRegisteredClient({ redirectUris: [REDIRECT] });
    expect(resolveRegisteredClient(`${clientId}x`)).toBeNull();
  });

  it("verifies S256 PKCE and signed authorization codes", () => {
    const challenge = createHash("sha256").update(VERIFIER).digest("base64url");
    expect(verifyPkce(VERIFIER, challenge)).toBe(true);
    expect(verifyPkce(`${VERIFIER}x`, challenge)).toBe(false);

    const clientId = createRegisteredClient({ redirectUris: [REDIRECT] });
    const code = createAuthorizationCode({
      clientId,
      redirectUri: REDIRECT,
      codeChallenge: challenge,
      partnerKey: "cat",
      resource: RESOURCE,
      scope: normalizeScopes("life:read life:write offline_access"),
    });
    const resolved = resolveAuthorizationCode(code);
    expect(resolved?.partnerKey).toBe("cat");
    expect(resolved?.resource).toBe(RESOURCE);
  });

  it("binds access and refresh tokens to the exact MCP resource", () => {
    const tokens = issueMcpTokens({
      partnerKey: "fish",
      resource: RESOURCE,
      scope: ["life:read", "life:write", "offline_access"],
    });
    const request = new Request(RESOURCE, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(resolveAccessToken(request, RESOURCE)?.partnerKey).toBe("fish");
    expect(resolveAccessToken(request, "https://example.com/mcp")).toBeNull();
    expect(resolveRefreshToken(tokens.refreshToken, RESOURCE)?.partnerKey).toBe("fish");
    expect(resolveRefreshToken(tokens.refreshToken, "https://example.com/mcp")).toBeNull();
  });
});
