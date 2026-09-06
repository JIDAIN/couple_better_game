# R11.2 Native OAuth Redirect Compatibility

## Context

RikkaHub reached Production OAuth discovery and dynamic registration, but `POST /oauth/register` returned `400 INVALID_REDIRECT_URIS`.

R11.1 added safe diagnostics and confirmed the failure was redirect validation, not MCP discovery or the signing secret.

## Change

`lib/server/life-mcp-auth.ts` now accepts OAuth redirect URIs suitable for public native clients using mandatory PKCE:

- HTTPS redirect URIs
- HTTP loopback redirect URIs on `localhost`
- IPv4 loopback `127.0.0.0/8`
- IPv6 loopback `::1`
- private-use application URI schemes (for native-app callbacks)

Still rejected:

- remote plaintext HTTP
- LAN plaintext HTTP
- `file:`, `data:`, `javascript:`, `ftp:`, `ws:`, `wss:` schemes
- redirects with embedded credentials

The authorization flow still requires S256 PKCE and exact redirect URI binding to the signed client registration.

## Acceptance target

After Production deployment, RikkaHub should progress from dynamic registration to the Life OAuth login page. Final MCP acceptance continues with token exchange, `initialize`, `tools/list`, `life_query`, and `life_mutate`.
