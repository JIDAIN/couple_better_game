# AI 访问与写入架构

## 1. 目标

AI 不是“饮食专属入口”。随着 V2 扩展，ChatGPT 可以逐步读取/记录：

```text
meal
mood
sleep
activity
weight
medicine
future domains: cycle / medication-log / ...
```

但不能因此获得一个可任意执行 SQL 的通用数据库入口。

R8 起，对外只暴露一个稳定的 Production MCP 地址：

```text
https://couple-better-game.vercel.app/mcp
```

新增生活模块时优先在服务端注册新 domain，而不是新增一套 ChatGPT 连接。

## 2. 统一流水线

```text
用户自然语言 / 当前聊天图片
↓
ChatGPT conversation layer：理解，但不写
↓
life_capabilities / life_query 获取事实
↓
形成 domain draft
↓
用户明确确认“记上 / 保存 / 修改”
↓
life_write(confirmed=true, stable idempotency key)
↓
Domain adapter：prepare + validate
↓
Canonical domain service / restricted RPC
↓
Supabase transaction
↓
read-back / receipt lookup
↓
确认结果后再回复成功
```

确认边界属于对话层；字段合法性属于领域层；数据权限属于 OAuth 身份与服务端/RPC 层。

## 3. 稳定 MCP 工具层

R8 固定三种顶层工具：

```text
life_capabilities
life_query
life_write
```

`domain` 是服务端注册项，例如：

```text
life_query(domain="medicine", ...)
life_query(domain="meal", ...)
life_write(domain="meal", action="create", ...)
```

这样以后新增 `cycle`（生理期）时，只需：

1. 建立 cycle schema / canonical service；
2. 建立只允许 cycle 事实的 adapter；
3. 在 `life_capabilities` 中注册；
4. 在 `life_query / life_write` 路由中启用。

只要顶层 MCP 工具 schema 不发生破坏性变化，Production `/mcp` 地址和既有 ChatGPT 连接都不需要重建。

## 4. OAuth 与身份

MCP 不复用 Supabase service-role key 作为 ChatGPT 凭据。

```text
ChatGPT
↓ OAuth 2.1 / PKCE S256
/oauth/register
/oauth/authorize
/oauth/token
↓
现有 fixed life account（cat / fish）
↓
短期 access token + refresh token
↓
/mcp
```

约束：

- `LIFE_MCP_SIGNING_SECRET` 必须与 Supabase secret 独立；
- access / refresh token 绑定精确 resource audience：Production `/mcp`；
- authorization code 仅 5 分钟有效；
- authorization code 的 SHA-256 hash 写入 `life_mcp_code_redemptions`，确保跨 serverless 实例只能兑换一次；
- `life_mcp_code_redemptions` 开启 RLS，浏览器角色无表权限；
- 个人写入的 `partnerKey` 不相信模型参数，由 OAuth identity 强制覆盖。

因此：

```text
cat 账号 OAuth -> “我”只能写 cat
fish 账号 OAuth -> “我”只能写 fish
```

读取共同数据（例如家庭药箱）仍由具体 domain 定义。

## 5. 通用写入协议与幂等

`lib/ai/record-write-protocol.ts` 负责横切能力：

- `RecordSource`；
- AI writable domain；
- ChatGPT 幂等键格式；
- confirmed write envelope 类型。

通用层**不负责**：

- 猜测某个领域的字段；
- 计算业务值；
- 绕过 domain validator；
- 直接执行 SQL。

新 domain 使用：

```text
chatgpt:<domain>:<scope>:<record-date>:<confirmation-nonce>
```

示例：

```text
chatgpt:mood:cat:2026-09-03:turn-123
chatgpt:meal:fish:2026-09-03:lunch-456
chatgpt:medicine:household:2026-09-03:new-box-1
```

同一次明确确认的重试必须复用同一个 key。工具返回不确定时必须先 read-back / receipt lookup，禁止生成新 key 连续盲写。

## 6. `record_write_receipts`

新 V2 domain 可使用独立回执表记录已经发生的外部写入：

```text
source
domain
idempotency_key
entity_id
```

这样即使实体后来被用户手动修改，旧 AI key 仍然不会被遗忘。

Meal 当前继续使用已经上线的 meal-specific idempotency RPC；后续可平滑桥接统一 receipt。

## 7. 图片输入与餐食照片

ChatGPT 当前聊天上传文件通过 MCP 工具 `_meta["openai/fileParams"]` 传入 `life_write.file`，服务端只接受 OpenAI/ChatGPT 文件下载域名，不接受模型任意提供的 URL。

手动上传和 ChatGPT 上传共用 `lib/server/image-compression.ts`：

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

目标通常为 50–100 KB；120 KB 是触发继续降质量的阈值，不是通过无限降质保证的硬上限。

压缩完成后才上传 Supabase Storage；数据库只保存最终对象路径。若数据库绑定失败，会删除刚上传的孤儿对象。

## 8. Web 与 AI 共用什么

共用：

```text
同一事实表
同一 domain payload shape
同一 canonical write logic
同一约束
```

不同：

```text
Web manual -> Next.js API -> source=manual
ChatGPT -> OAuth MCP -> domain adapter -> source=chatgpt
Import -> import adapter -> source=import
```

浏览器 route 会强制 `source=manual`，不能由浏览器请求体伪造 `source=chatgpt`。

## 9. 当前领域接入状态

### Meal

- 查询：已接入；
- 新增：已接入 ChatGPT 专用幂等 RPC；
- 当前聊天照片：已接入；
- 个人 owner：OAuth identity 强制覆盖。

### Medicine

- 查询：已接入家庭药箱；
- 写入：R8 暂不开放，等待 medicine-specific provenance / idempotency adapter 完成；
- 不允许通过通用 SQL 修改库存。

### Mood / Sleep / Activity

- 查询：已接入日期事实；
- 写入：通过现有 canonical RPC；
- 强制 `source=chatgpt` 与稳定幂等键。

### Weight

- 查询：已接入；
- 写入：R8 暂不开放，等待 weight-specific AI provenance / idempotency adapter；
- AI 写真实体重只能进入 `weight_measurements`，不能自动覆盖 `daily_record_sides.weight_kg`。

## 10. 删除与修改

AI 新增和 AI 修改是不同意图。

```text
“新买了一盒布洛芬，记上” -> create
“这盒吃完了，改成已用完” -> update
```

已有记录不会因为用户在聊天中补充一句信息就自动覆盖；必须有明确的修改意图。R8 未注册的写操作直接返回 `WRITE_NOT_REGISTERED`，不会降级为任意数据库写入。

## 11. 安全底线

- Supabase secret 不进入浏览器/普通聊天；
- MCP OAuth 签名使用独立 secret；
- ChatGPT 不获得游戏钱包/兑换表通用写权限；
- 未确认只允许讨论/读取，不写；
- 不因 AI 推断自动修改体重、热量、药品数量等事实；
- domain 写入完成后必须能够追踪来源；
- 不允许任意 SQL / 任意 URL 下载；
- 真实家庭药箱 Excel、真实账号密码和生产 secret 不提交到 GitHub。
