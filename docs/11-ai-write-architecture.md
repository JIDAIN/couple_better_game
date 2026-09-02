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
```

但不能因此获得一个可任意执行 SQL 的通用数据库入口。

## 2. 统一流水线

```text
用户自然语言 / 图片
↓
Conversation layer：理解，但不写
↓
形成 domain draft
↓
用户明确确认“记上 / 保存 / 修改”
↓
生成稳定 idempotency key
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

确认边界属于对话层；字段合法性属于领域层；数据权限属于服务端/RPC 层。

## 3. 通用层负责什么

`lib/ai/record-write-protocol.ts` 只负责横切能力：

- `RecordSource`；
- AI writable domain；
- ChatGPT 幂等键格式；
- confirmed write envelope 类型。

通用层**不负责**：

- 猜测某个领域的字段；
- 计算业务值；
- 绕过 domain validator；
- 直接执行 SQL。

## 4. 幂等键

新 domain 使用：

```text
chatgpt:<domain>:<scope>:<record-date>:<confirmation-nonce>
```

示例：

```text
chatgpt:mood:fish:2026-09-02:turn-123
chatgpt:weight:cat:2026-09-02:turn-456
chatgpt:medicine:household:2026-09-02:new-box-1
```

同一次明确确认的重试必须复用同一个 key。

## 5. `record_write_receipts`

新 V2 domain 可使用独立回执表记录已经发生的外部写入：

```text
source
domain
idempotency_key
entity_id
```

这样即使实体后来被用户手动修改，旧 AI key 仍然不会被遗忘。

工具返回不确定时：

```text
先查 receipt / read-back
↓
未确认成功才用 same key 重试
```

禁止因为超时生成新 key 连续盲写。

## 6. Web 与 AI 共用什么

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
ChatGPT -> authorized connector / restricted wrapper -> source=chatgpt
Import -> import adapter -> source=import
```

浏览器 route 会强制 `source=manual`，不能由浏览器请求体伪造 `source=chatgpt`。

## 7. 各领域接入方式

### Meal

现有 ChatGPT meal RPC 已经上线，并有自己的 idempotency 机制。后续 kcal optional 重构时，再评估是否桥接统一 receipt。

### Mood / Sleep / Activity

V2-P1 先建立 canonical RPC + Web API。未来 ChatGPT adapter 只需要：

1. 对话确认；
2. 生成 domain-scoped key；
3. 强制 `source=chatgpt`；
4. 调用对应 canonical write；
5. read-back。

### Weight

AI 写真实体重只进入 `weight_measurements`，不能自动覆盖 `daily_record_sides.weight_kg`。

### Medicine

家庭药箱 schema 确认后，AI adapter 只允许操作 medicine domain 的受限 RPC，并保留 change log。不能通过通用 SQL 修改库存。

## 8. 删除与修改

AI 新增和 AI 修改是不同意图。

```text
“新买了一盒布洛芬，记上” -> create
“这盒吃完了，改成已用完” -> update
```

已有记录不会因为用户在聊天中补充一句信息就自动覆盖；必须有明确的修改意图。

## 9. 安全底线

- Supabase secret 不进入浏览器/普通聊天；
- ChatGPT 不获得游戏钱包/兑换表通用写权限；
- 未确认只允许讨论/读取，不写；
- 不因 AI 推断自动修改体重、热量、药品数量等事实；
- domain 写入完成后必须能够追踪来源；
- 真实家庭药箱 Excel 不提交到 GitHub。
