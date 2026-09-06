# R11 — MCP 主链路接入 AI Access Core

> 状态：代码已合并 main，CI Test / Lint / Build 全绿；未部署 Production。

## 目标

把现有 `/mcp` 从 R8 时代独立维护的 `life_query / life_write` 实现，切换为与 Harbor、程序内置 AI 共用的 AI Access Core。

目标结构：

```text
MCP client
→ /mcp
→ MCP Adapter
→ life-agent-executor
→ AI Access Core / canonical services
→ Supabase Database / Storage
```

Harbor Sheet / Apps Script / Fast Wake 不进入 MCP 主链路。

## 核验结论

R11 开始前，仓库已经存在：

- `/mcp` JSON-RPC endpoint；
- OAuth / PKCE / dynamic client registration；
- Cat/Fish OAuth 身份绑定；
- `life:read / life:write` scope；
- MCP 文件参数与餐食图片下载/压缩；
- 独立 `life-mcp-tools.ts`。

但旧 MCP 工具层仍停留在 R8 contract：

- `life_capabilities`
- `life_query(domain, filters)`
- `life_write(domain, action, confirmed, idempotencyKey, payload)`

并且写入只覆盖 meal create、mood/sleep upsert、activity create。

与此同时，当前 AI Access Core 已经通过 `life-agent-executor` / `life-agent-registry` 支持更完整的：

- `life_query(resource, ...)`
- `life_mutate(resource, action, id, data, ...)`
- 中文 aliases / 默认日期 / 单位归一；
- clarification；
- partial update hydration；
- meal / mood / sleep / activity / weight / medicine / mailbox / settings / legacy_home；
- ownership / delete safety；
- media pipeline。

因此旧 MCP 已经形成第二套业务实现，继续维护会产生语义漂移。

## R11 改动

### 1. MCP 只做 Adapter

`lib/server/life-mcp-tools.ts` 不再自行实现各 domain 的查询和写入。

它现在负责：

- MCP tool schema 适配；
- OAuth scope 校验；
- OAuth identity → `FixedLifeIdentity`；
- MCP file reference → 现有 WebP media boundary；
- MCP JSON-RPC call id → Core toolCallId；
- Core result / clarification → MCP ToolResult。

真正业务执行统一调用：

```text
executeLifeAgentTool
→ life-agent-executor
→ life-agent-registry
```

### 2. MCP 工具统一为 Core contract

公开工具：

- `life_capabilities`
- `life_query`
- `life_mutate`

不再公开旧 `life_write`。

普通读取直接 `life_query`；普通写入直接 `life_mutate`；不要例行 capability probe。

### 3. 删除与高风险安全

Core 的 delete / legacy overwrite 安全规则依赖“用户当前消息”。

因此 MCP `life_mutate` 增加必填 `userText`：客户端应传入触发本次写入的当前用户原始消息。

Adapter 不自己判断删除是否安全，而是把 `userText` 传给 Core，让统一安全规则继续生效。

### 4. 幂等

`/mcp` 将 JSON-RPC request id 映射为 Core `toolCallId`：

```text
mcp:<json-rpc-id>
```

同一个 MCP tool call 的服务端幂等语义继续由 AI Access Core 负责，不重新引入 MCP 专属业务幂等实现。

### 5. 图片

MCP `life_mutate` 继续支持 OpenAI file parameter。

链路：

```text
MCP file reference
→ allowlisted HTTPS download
→ input size guard
→ existing compressMealPhoto
→ LifeAgentAttachment
→ AI Access Core meal mutation
→ Supabase Storage
```

MCP 不自行定义新的图片业务规则。

### 6. clarification

`LifeClarificationError` 转换为：

```json
{
  "ok": false,
  "errorCode": "LIFE_CLARIFICATION_REQUIRED",
  "clarification": {
    "question": "...",
    "missing": []
  }
}
```

客户端应该直接把 `clarification.question` 问给用户，而不是解释内部 schema。

## 不改变的边界

- OAuth / PKCE / token audience 不变；
- Cat/Fish 身份仍由 OAuth token 决定，不能由 tool arguments 覆盖；
- `life:read` / `life:write` scope 不变；
- AI Access Core / canonical services 是业务真相；
- Harbor 继续作为当前 Plus 环境下的兼容入口；
- 本阶段不部署 Production。

## 代码与 CI 验收

PR #73：`R11: route MCP through AI Access Core`

合并 commit：

```text
96cee880a523e5186fc924ffc6b56a7cb376bfde
```

CI run #395：

- Test ✅
- Lint ✅
- Build ✅

第一次 CI build 曾捕获一个 TypeScript union schema typing 问题；修正为先把 tool parameters 归一成 `Record<string, unknown>` 后重新运行，最终三项全绿。

新增测试：

```text
tests/server/life-mcp-core-adapter-source.test.ts
```

固定以下边界：

- MCP 必须调用 `life-agent-executor`，不能重新维护第二套业务实现；
- 公开 contract 为 `life_query / life_mutate`；
- mutation 必须把当前 `userText` 交给 Core；
- OAuth read/write scope 和固定身份绑定保留；
- 图片复用现有 compression/media boundary；
- clarification 保留结构化问题；
- JSON-RPC id 进入 Core toolCallId。

## Production 前剩余验收

代码层已经 ready，但还没有对 Production `/mcp` 做真实 smoke test，因为本轮没有获得新的 Production deployment 授权。

Production 部署后需要验证：

1. OAuth protected-resource / authorization metadata；
2. `initialize`；
3. `tools/list` 只出现 `life_capabilities / life_query / life_mutate`；
4. Cat 身份 `life_query` 真实读取；
5. `life_mutate` clarification；
6. 真实 create / partial update / delete；
7. meal file parameter；
8. Fish 身份隔离；
9. latency 与 Harbor Drive bridge 对照。

任何 Production deployment 仍需用户当次明确授权。
