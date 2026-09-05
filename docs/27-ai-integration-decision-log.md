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

## 2026-09-05 — meal 输入不得要求 AI 猜 rawName

### 问题

用户要求记录“牛肉面一碗、鸡蛋一个”。AI 先后尝试：

```text
items[].name
items[].foodName
```

服务端内部实际要求 `items[].rawName`，造成多次 failed。

### 根因层

AI Access Core / Input contract。

### 决定

餐食输入必须增加 normalization 层，AI 不需要知道数据库 / 内部 DTO 的唯一字段名。

目标至少兼容：

```text
name
foodName
rawName
```

数量表达同时兼容业务友好的形式，并统一转换到 canonical meal payload。

### 为什么

`rawName` 属于内部实现细节；如果未来 MCP 仍要求模型记住它，则说明 contract 设计失败。

### 修改位置

meal mutation normalization / validation（待完成）。

### Harbor 影响

团子可以直接用业务友好字段，不必读取 schema 后反复试错。

### MCP / 未来入口复用

完整复用同一 normalization。

### 安全影响

不改变 owner / authorization；只改善输入兼容。

### 兼容性

必须继续支持现有 canonical `rawName` payload。

### 测试 / Production 验收

待代码修复后覆盖：name / foodName / rawName、quantity、amount+unit，以及重复请求幂等。

### 未来可删除内容

Project prompt 里 meal 内部字段说明和 AI schema 猜测流程。

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
