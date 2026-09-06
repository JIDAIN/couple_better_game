# AI 接入决策记录

> 用途：记录 AI 接入开发中所有会影响 Harbor、MCP、业务 contract、权限、安全、性能和未来迁移的关键决定。  
> 架构基线：`docs/26-ai-access-core-principles.md`

## 使用规则

以后每次遇到 AI 接入问题，先判断属于哪一层：

```text
AI planning
Adapter / transport
AI Access Core / contract
Authorization
Canonical business service
Database / storage
Media pipeline
```

只要修改了以下任一内容，就应新增一条记录：

- `life_query / life_mutate / life_capabilities` contract；
- Harbor Bridge；
- MCP；
- cat / fish 身份与权限；
- schema normalization；
- 枚举 / label；
- 幂等；
- delete / 高风险规则；
- Fast Wake / Drive Watch / polling；
- 图片 / 附件链路；
- AI 入口替换策略。

每条至少记录：

```text
日期
问题
根因层
决定
为什么
修改位置
Harbor 影响
MCP / 未来入口复用
安全影响
兼容性
测试 / Production 验收
未来可删除内容
```

---

## 2026-09-05 — 确立 AI Access Core 分层

### 问题

当前 Harbor 已能让 ChatGPT Project 访问 Couple Better Game，但开发过程中出现了 transport、schema、业务语义等不同类型的问题，容易把临时 Bridge 逻辑和长期业务逻辑混在一起。

### 根因层

Architecture。

### 决定

正式采用：

```text
AI Entry / Adapter（可替换）
→ AI Access Core（长期稳定）
→ Canonical Life Services（长期稳定）
→ Supabase / Storage / Drive archives
```

Harbor 被定义为 Adapter，不是业务核心。未来 MCP 是替换 Adapter，而不是重写业务系统。

### 为什么

目标是未来更换 ChatGPT Project、MCP、OpenAI API、Gemini、DeepSeek 等 AI 入口时，保留同一套业务 schema、权限、安全和数据层。

### 修改位置

- `docs/26-ai-access-core-principles.md`
- 本决策日志

### Harbor 影响

继续保留并完善，但只能承载 transport-specific 逻辑。

### MCP / 未来入口复用

完整复用 AI Access Core 和 canonical services。

### 安全影响

身份和权限继续由服务端强制，不依赖昵称或 prompt。

### 兼容性

向后兼容当前 Harbor。

### 测试 / Production 验收

文档级架构决定，不触发 Production。

### 未来可删除内容

MCP 成熟后可删除 Harbor transport：COMMANDS / RECEIPTS、Apps Script Worker、Fast Wake、Drive Watch、Bridge pairing 等。

---

## 2026-09-05 — moodKey 必须由程序返回 moodLabel

### 问题

Harbor 查询得到数据库：

```text
partner_key = fish
mood_key = neutral
```

AI 根据英文自行把 `neutral` 解释成“平静 / 一般”，但产品实际语义是“心动”。

### 根因层

AI Access Core / Business semantics。

### 决定

程序维护唯一 mood 映射，并在查询结果中直接返回：

```json
{
  "moodKey": "neutral",
  "moodLabel": "心动"
}
```

网页和 AI 共用同一映射源。

### 为什么

内部枚举值不应依赖 AI 自行翻译；prompt 不应承担业务字典职责。

### 修改位置

程序 mood label / life query result enrichment。

### Harbor 影响

Harbor 只透传结果，不需要维护 mood 字典。

### MCP / 未来入口复用

完全复用，同样读取 `moodLabel`。

### 安全影响

无权限变化。

### 兼容性

保留 `moodKey`，新增 `moodLabel`，向后兼容。

### 测试 / Production 验收

Production 已验证 fish `neutral` 返回 `moodLabel = 心动`，与网页一致。

### 未来可删除内容

Project prompt 中所有 mood key → 中文映射说明。

---

## 2026-09-05 — 自然语言输入统一进入 AI Access Core normalizer

### 问题

meal 暴露出 `name / foodName / rawName` 猜测失败，但同一问题会出现在体重、药箱、睡眠、活动、信箱、设置等所有 AI 写入资源。如果逐个把内部字段写进 Project prompt，会导致模型入口绑定业务实现，未来 MCP 迁移困难，而且用户缺少信息时容易看到内部 schema 错误而不是自然追问。

### 根因层

AI Access Core / Input contract。

### 决定

所有 AI 入口统一采用：

```text
自然语言
→ 模型只负责意图理解与事实抽取
→ Natural Input Normalizer
→ canonical contract
→ canonical parser / authorization / idempotency
→ Supabase
```

信息分三类：

1. 可以安全默认：由程序补，例如 today、本月、medicine create quantity=1；
2. 可以确定映射：由程序归一，例如中文 resource/action、person、meal item aliases、单位、时间、UI label；
3. 不可安全推断：返回 `LIFE_CLARIFICATION_REQUIRED` 和一个用户可直接回答的问题。

Canonical parser 保持严格，normalizer 只存在于 AI Access Core boundary，不改变网页/数据库正式 DTO。

### 为什么

AI 应学习“用户意图”，不应学习内部数据库字段。未来无论 Harbor、内置 AI 还是 MCP，都应共享同一自然语言 contract，而不是各自维护提示词字典。

### 修改位置

- `lib/ai/life-input-normalizer.ts`
- `lib/server/life-agent-registry.ts`
- `lib/server/drive-bridge-service.ts`
- `lib/server/life-ai-gateway.ts`
- `docs/28-ai-natural-language-contract.md`
- `tests/ai/life-input-normalizer.test.ts`
- `tests/server/life-agent-registry.test.ts`

### Harbor 影响

Harbor 可以继续提交 `life_query / life_mutate`，但常见字段别名会由 Core 自动归一。缺少关键信息时 receipt 的 error 为自然追问，并同时支持结构化 `errorCode/clarification`；Harbor 不应让用户排查 `rawName` 等内部字段。

餐食照片在 Adapter 预处理边界也接受 `meal / 三餐 / 餐食 / 饮食 / 吃饭`，避免“文字能写、照片因 resource alias 被提前拒绝”。

### MCP / 未来入口复用

Natural Input Normalizer 是长期 Core 能力。当前旧 R8 MCP 工具实现仍有独立 domain/write 代码，后续迁移时应保留 MCP OAuth、scope、file handling 和外部 idempotency 语义，但把自然输入和业务执行逐步转到同一 Core，不复制新 schema。

### 安全影响

- 不放宽 cat/fish ownership；
- delete 仍先检查当前消息明确删除意图；
- update/delete 不猜 UUID；
- legacy_home 仍要求精确确认短语；
- canonical parser 继续最终严格校验。

### 兼容性

现有 canonical payload 继续支持；新增 common alias/default 是向后兼容扩展。

### 测试 / Production 验收

自动测试覆盖 query 默认日期/person、mood label、meal aliases/份量、weight string、medicine aliases/default quantity、mailbox、activity duration、settings、clarification 与 delete safety。CI Test/Lint/Build 已通过分支版本；Production 尚未部署，等待用户统一验收阶段前授权。

### 未来可删除内容

Project prompt 中业务字段表、meal `rawName` 说明、mood 枚举表、绝大多数 schema troubleshooting 指令。

---

## 2026-09-05 — Fast Wake 属于 Harbor transport，不进入业务 contract

### 问题

Harbor 通过 Google Sheet + Apps Script 时，1 分钟 polling fallback 造成查询和写入延迟；为加速增加 Fast Wake，并经历 Web App URL、404、502、重定向和 retry 调试。

### 根因层

Adapter / transport。

### 决定

Fast Wake 只作为 Harbor transport 性能机制：

```text
COMMANDS
→ Fast Wake
→ Apps Script Worker
→ life_*
```

它不得成为 `life_query / life_mutate` 的业务语义，也不得影响 domain service API。

### 为什么

未来 MCP 直连不需要 Fast Wake；如果业务层依赖 Fast Wake，就无法无痛替换入口。

### 修改位置

Harbor / Vercel drive-bridge transport。

### Harbor 影响

正常走秒级 Wake，1 分钟 trigger 保留 fallback。

### MCP / 未来入口复用

不复用。MCP Adapter 直接调用 core。

### 安全影响

Wake token 只能唤醒，不应扩大业务权限；业务身份仍由 Bridge 固定认证。

### 兼容性

保留 polling fallback。

### 测试 / Production 验收

已验证 Google Web App 302 → googleusercontent 200；真实 `life_query` Worker 执行约 1 秒。

### 未来可删除内容

Fast Wake endpoint/token、Apps Script wake secret、Drive Watch、polling trigger。

---

## 2026-09-05 — 后续开发记录模板

复制下面模板追加：

```markdown
## YYYY-MM-DD — 决策标题

### 问题

### 根因层

### 决定

### 为什么

### 修改位置

### Harbor 影响

### MCP / 未来入口复用

### 安全影响

### 兼容性

### 测试 / Production 验收

### 未来可删除内容
```
