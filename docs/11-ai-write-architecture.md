# AI 访问与写入架构

## 1. 目标

AI 不是“饮食专属入口”。随着 V2 扩展，AI 可以逐步读取/记录：

```text
meal
mood
sleep
activity
weight
medicine
mailbox
settings
legacy game snapshot
future domains: cycle / medication-log / ...
```

但不能因此获得一个可任意执行 SQL 的通用数据库入口。

R8 建立了稳定的 Production MCP 地址：

```text
https://couple-better-game.vercel.app/mcp
```

R9 在此基础上新增**程序内置 AI Agent**。MCP 保留为可选外部客户端接口，但不再把“AI 能不能用”绑定到 ChatGPT 套餐是否开放自定义 MCP。

## 2. R9 主路径：程序内置 AI

```text
已登录 cat / fish 用户
↓
/ai
↓
POST /api/ai/chat
↓
fixed life signed session
↓
Vercel AI Gateway
↓ tool calling
life_capabilities / life_query / life_mutate
↓
canonical domain service / restricted RPC
↓
Supabase PostgreSQL / Storage
```

关键点：

- AI 复用现有 `life-account-session`，不建立第三套账号；
- 当前登录 cat 时，AI 的“我”就是 cat；fish 同理；
- 模型参数里的 owner 不可信，个人记录由服务端强制覆盖成当前身份；
- Vercel Production 优先使用自动注入的 `VERCEL_OIDC_TOKEN` 访问 AI Gateway；也支持 `AI_GATEWAY_API_KEY` 作为显式覆盖；
- 默认模型可由 `LIFE_AI_MODEL` 替换，业务权限与模型供应商解耦；
- `LIFE_TIME_ZONE` 默认 `Asia/Shanghai`，用于“今天/昨天”等日期语义。

## 3. 稳定内部 Tool Registry

R9 内部固定三个顶层工具：

```text
life_capabilities
life_query
life_mutate
```

`resource` 是服务端注册项。当前查询：

```text
day
month
meal
weight
medicine
mailbox
settings
life_export
legacy_home
```

当前修改：

```text
mood      upsert
sleep     upsert
activity  create / update / delete
meal      create / update / delete + photo
weight    create / update / delete
medicine  create / update / delete
mailbox   create / update / delete
settings  update
legacy_home replace（强确认）
```

以后新增 `cycle` 时，只需建立 canonical cycle service，并在 registry 注册 `cycle` 查询/修改动作；聊天 UI、AI Gateway 和用户登录层不需要重做。

## 4. 权限等价于“当前用户”，不是数据库管理员

R9 的目标是“AI 像当前用户一样操作”，而不是“AI 获得 service-role 自由执行能力”。

```text
当前用户权限
↓
server-side registry 强制解释
↓
已有 canonical service
↓
已有 RPC / 表约束
```

具体边界：

- Mood / Sleep / Meal / Weight：写入 owner 强制绑定当前账号；
- Meal / Weight 修改删除前再次核验记录属于当前账号；
- Mailbox：sender 强制当前账号、recipient 强制 Ta，不能改/删 Ta 发出的信；
- Medicine：家庭共享数据，两边账号都可按现有产品规则 CRUD；
- Activity：沿用现有共享活动 API 的写入边界；
- Settings：周年日共享，目标体重只改当前账号；
- 删除：用户当前消息必须明确出现删除意图；
- `legacy_home.replace`：用户当前消息必须明确包含 `确认覆盖游戏数据`；
- 不提供任意 SQL、任意 Supabase REST、任意 URL 下载工具。

## 5. AI 查询“所有信息”

R9 不只支持几个页面级查询。

`life_export` 直接复用 R8 的服务端完整 V2 导出，可覆盖：

```text
mood_entries
sleep_records
activity_entries
meals
meal_items
medicine_items
weight_measurements
mailbox_letters
partner_profiles
```

`settings` 单独读取周年日和目标体重；`legacy_home` 读取旧 `/game` 的完整同步快照。因此 AI 既能回答单领域问题，也能在确有必要时做跨领域汇总。

普通问题应优先最小查询，避免每一句都拉完整导出。

## 6. 图片输入与餐食照片

程序内置 AI 和网页手动上传共用 `lib/server/image-compression.ts`：

```text
原图最大 10 MB
↓ EXIF rotate
最长边 600 px，禁止放大
↓
WebP quality 70
↓ 如果 > 120 KB
65 -> 60 -> 55
↓
最低 quality 55
```

`/api/ai/chat` 在调用视觉模型前先完成上述压缩。

如果用户只问“这是什么”，图片只用于本轮 AI 理解；如果用户明确说“这是午饭，帮我记上”，模型调用 `life_mutate(resource="meal", ..., attachPhoto=true)`，同一张压缩后的 WebP 会上传 Supabase Storage 并绑定餐食记录。

若数据库照片绑定失败，会删除刚上传的孤儿对象；替换成功后会清理旧照片对象。

## 7. 模型调用与供应商解耦

R9 通过 Vercel AI Gateway 的 OpenAI-compatible Chat Completions 接口调用视觉 + tool-use 模型。

代码不把业务逻辑写进某个模型 SDK：

```text
LIFE_AI_MODEL
↓
AI Gateway
↓
模型输出 tool call
↓
life-agent-registry
```

因此后续可以只改模型名，在不触碰数据库权限、领域服务、UI 和 tool registry 的情况下切换模型。

Production 优先使用 Vercel OIDC，避免把第三方模型 API key 下发浏览器。所有模型调用只发生在 Node.js server route。

## 8. 对话执行规则

AI 的系统规则明确要求：

1. 涉及程序已有事实必须先查真实数据；
2. 用户明确要求新增/修改时直接调用工具，不只给操作教程；
3. 缺 ID 时先查询，再 update/delete；
4. 用户只是讨论时不写库；
5. 工具失败不能声称成功；
6. 最多连续 8 轮工具调用，防止失控循环；
7. 聊天只向模型携带最近有限条文本历史，大体量事实始终重新从数据库读取。

## 9. R8 MCP 作为备用外部接口

R8 MCP 仍保留：

```text
ChatGPT / future MCP client
↓ OAuth 2.1 / PKCE
/mcp
↓
canonical services
```

它仍然具备独立 `LIFE_MCP_SIGNING_SECRET`、精确 audience、一次性 authorization code、RLS redemption 表等安全边界。

但 R9 之后，产品自身的 AI 功能不再依赖 ChatGPT 是否向个人套餐开放自定义 MCP。未来如果外部客户端重新具备条件，可以继续使用 `/mcp`，无需推翻内置 AI。

## 10. provenance 与幂等

`lib/ai/record-write-protocol.ts` 继续负责 AI 横切协议。

Mood / Sleep / Activity / Meal 的内部 Agent 写入沿用现有 `source=chatgpt` 作为历史 AI provenance，并生成稳定格式的幂等键：

```text
chatgpt:<domain>:internal-<partner>:<record-date>:<tool-call-id>
```

这里的 `chatgpt` 是当前数据库既有的 AI 来源枚举名称；R9 不为了改名额外做破坏性 schema migration。后续若引入统一 `source=ai`，应作为独立 migration 处理。

Medicine / Weight 等仍通过各自 canonical service 写入，不允许绕过 parser / RPC 做任意更新。

## 11. 新 domain 接入规范

新增例如 `cycle`：

1. 建立数据库事实表与约束；
2. 建立 server-only canonical service / RPC；
3. 明确 cat/fish owner 或 household 共享规则；
4. 在 `life-agent-registry.ts` 注册 query/mutate；
5. 更新 `life_capabilities` 描述；
6. 增加权限与幂等测试；
7. MCP 若也需要该能力，再把同一个 canonical service 接入 MCP adapter。

禁止为了“让 AI 什么都能做”增加：

```text
run_sql
raw_supabase_request
fetch_any_url
write_any_table
```

## 12. 安全底线

- Supabase secret 不进入浏览器或模型上下文；
- AI Gateway credential 只在 Vercel server runtime；
- 当前登录身份决定个人数据 owner；
- AI 不得冒充 Ta 写个人记录；
- 删除要求当前消息明确删除；
- 全量旧游戏覆盖要求固定确认短语；
- 不允许任意 SQL / 任意 URL；
- 图片在服务端压缩后才发模型或存储；
- 真实账号密码、生产 secret、真实家庭数据不提交 GitHub；
- MCP 与内置 AI 都只调用 canonical 业务服务，不建立第二套事实源。
