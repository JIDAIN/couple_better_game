# R11 Production MCP 真实验收（2026-09-06）

> Production deployment: `dpl_7pDwF2x4utWvUEG8mFUZeK8bwNZj`

## 已完成的 Production 实测

1. 首页 `https://couple-better-game.vercel.app/` 返回 200。
2. `GET /mcp` 在未携带 OAuth access token 时返回 401，并包含 `WWW-Authenticate`，指向 `/.well-known/oauth-protected-resource`，scope 为 `life:read life:write`。
3. `GET /.well-known/oauth-protected-resource` 返回 200，Production metadata 正确声明：
   - resource: `/mcp`
   - authorization server: Production origin
   - scopes: `life:read`, `life:write`, `offline_access`
   - bearer method: header
4. `GET /.well-known/oauth-authorization-server` 返回 200，Production metadata 正确声明：
   - authorization endpoint: `/oauth/authorize`
   - token endpoint: `/oauth/token`
   - registration endpoint: `/oauth/register`
   - authorization_code + refresh_token
   - PKCE S256
5. Vercel runtime logs确认以上请求均命中当前 R11 Production deployment，未观察到 runtime error。

## 尚未完成的 authenticated MCP 业务验收

以下项目需要一个真正完成 OAuth 登录、持有 access token 且能发送 MCP JSON-RPC POST 的客户端：

- `initialize`
- `tools/list`
- Cat/Fish OAuth identity isolation
- `life_query`
- `life_mutate`
- clarification
- create/update/delete
- partial update hydration
- meal photo file parameter
- authenticated latency measurement

当前维护会话可读取 Vercel Production URL，但现有 Vercel connector 只提供 GET fetch；容器环境无外网 DNS；当前 ChatGPT Plus 环境也不能直接作为完整可写自定义 MCP client 完成 OAuth + MCP POST。因此不能伪造“已完成真实 authenticated MCP 验收”。

## 已有非 Production-transport 证据

R11 PR #73 已将 MCP adapter 统一到 `life-agent-executor` / AI Access Core；CI Test/Lint/Build 通过。现有 Core Production 历史验收已覆盖自然语言归一、clarification、partial update、权限、delete safety、meal photo 等业务语义。但这些不能替代本节尚缺的“通过 Production `/mcp` OAuth token 发起真实 JSON-RPC POST”验收。

## 最终验收触发条件

当存在一个可用的远程 MCP client（例如支持自定义可写 MCP 的 ChatGPT 方案或其他 MCP client）时，直接连接：

`https://couple-better-game.vercel.app/mcp`

完成 OAuth 登录后，按顺序验收：initialize → tools/list → Cat read → clarification → create → query → partial update → delete → photo → Fish isolation，并清理测试数据。

## 状态

- R11 Production deployment: ✅
- OAuth discovery / protected resource: ✅
- unauthenticated protection: ✅
- runtime health: ✅
- authenticated MCP business smoke: ⏳ blocked by available client/tooling, not marked passed

Production auto-deploy remains disabled; no new Production deployment was created for this documentation update.
