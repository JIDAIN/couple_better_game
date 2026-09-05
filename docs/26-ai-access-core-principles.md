# AI Access Core 架构原则

> 状态：**长期架构基线 / 约束性文档**  
> 生效日期：2026-09-05  
> 适用范围：Couple Better Game 的 Harbor、MCP、程序内置 AI、未来第三方 AI API，以及所有新增生活模块。

## 1. 为什么需要这份文档

Couple Better Game 会长期接入 AI，但 AI 入口本身会变化。

当前主要入口是 ChatGPT Project + Harbor Bridge；未来可能切换为：

- ChatGPT MCP；
- OpenAI API / function calling；
- Gemini / DeepSeek / Claude 或其他模型；
- 程序内置免费 / 付费 AI；
- 其他支持工具调用的客户端。

因此系统不能把业务能力绑定在某一个 AI、Google Sheet、Apps Script 或某一种模型协议上。

**长期目标不是“把 Harbor 做成核心”，而是建立一个稳定的 AI Access Core。**

核心结构固定为：

```text
AI Entry / Adapter（可替换）
        ↓
AI Access Core（长期稳定）
        ↓
Canonical Life Services（长期稳定）
        ↓
Supabase / Storage / Drive archives（事实与文件层）
```

## 2. 三层架构

### 2.1 AI Entry / Adapter：可替换入口层

这一层负责把不同 AI 平台的请求转换为统一业务调用。

当前实现：

```text
ChatGPT Project
→ Harbor Google Sheet
→ Apps Script Worker
→ Fast Wake / fallback
→ Vercel Bridge Adapter
```

未来实现可以是：

```text
ChatGPT MCP
→ MCP Adapter
```

或者：

```text
程序内置 AI / 第三方 AI API
→ Function Calling Adapter
```

**Adapter 只负责协议转换、身份入口、调用和回执，不拥有业务规则。**

### 2.2 AI Access Core：统一 AI 能力层

所有 AI 入口最终必须进入同一个稳定能力层。

当前稳定工具面：

```text
life_capabilities
life_query
life_mutate
```

AI Access Core 负责：

- 固定身份解析；
- 权限控制；
- 输入 schema 标准化；
- 业务语义标准化；
- 幂等；
- 删除安全；
- 高风险操作确认；
- 文件 / 图片入口校验；
- 错误码与返回结构；
- 用户可读 label；
- 调用 canonical domain services。

### 2.3 Canonical Services + Data：长期事实层

真正的业务逻辑和正式数据位于：

```text
Canonical Life Services
→ Supabase Database
→ Supabase Storage
→ Google Drive（仅原图 / 档案 / 灾备）
```

永久原则：

- Supabase Database 是结构化生活数据唯一事实源；
- Supabase Storage 是程序展示图片存储；
- Google Drive 可以保存可信原图与备份，但不是正式结构化数据库；
- Google Sheet 只是 Harbor 的命令总线 / 镜像，不是正式数据源。

## 3. 不可违反的架构原则

### P1. 业务逻辑不得写进 Harbor

Harbor 可以负责：

- 接收 `COMMANDS`；
- 固定 cat / fish Bridge 身份；
- 唤醒 Worker；
- 转发 `life_*`；
- 写回 `RECEIPTS`；
- 保持 fallback。

Harbor **不得决定**：

- meal 的正式字段是什么；
- mood key 对应什么中文；
- 谁能修改谁的数据；
- delete 是否允许；
- 图片如何压缩；
- 某个 resource 的业务默认值；
- 数据库表结构；
- 某一业务动作的最终成功条件。

这些必须在 AI Access Core / canonical service 中实现。

### P2. MCP 不是新业务系统，只是新 Adapter

未来接入 MCP 时：

```text
Harbor Adapter  → 可删除 / 退役
MCP Adapter     → 新增
AI Access Core  → 保留
life_*          → 保留
Canonical Services → 保留
Supabase        → 保留
```

如果迁移到 MCP 需要重写 meal、mood、medicine、mailbox 等业务 CRUD，说明当前分层失败，应先重构，而不是复制一套 MCP 专用逻辑。

### P3. Schema 必须对 AI 友好，不要求模型猜内部实现

AI 不应被迫记住数据库内部字段。

例如餐食内部可能使用：

```text
rawName
portionDescription
```

但 AI Access Core 应接受清晰、稳定、可兼容的业务输入，并由程序做归一化。

原则：

- 对常见自然字段提供 alias / normalization；
- 错误信息指出可用字段，不让 AI 连续猜；
- schema 变化必须尽量向后兼容；
- schema 由程序定义，不依赖 Project prompt 维护。

### P4. 内部枚举不得让 AI 自行解释

内部 key 必须由程序返回用户可读 label。

例如：

```json
{
  "moodKey": "neutral",
  "moodLabel": "心动"
}
```

而不是只返回 `neutral` 再让模型翻译。

同类规则适用于：

- mood；
- meal type；
- activity type；
- medicine status；
- mailbox state；
- 未来 cycle 等模块的状态枚举。

### P5. 身份由服务端决定，不由聊天文本决定

当前正式身份：

```text
Harbor Cat  → cat
Harbor Fish → fish
```

未来 MCP / API 同样必须由可信认证上下文创建身份。

禁止使用以下内容作为授权身份来源：

- 用户说“我是 cat / fish”；
- AI 昵称“团子 / 仔仔”；
- payload 中自报 actor；
- Sheet 可编辑单元格；
- prompt 文本。

昵称只影响聊天体验，不参与鉴权。

### P6. 所有入口共享同一权限规则

Harbor、MCP、程序内 AI、未来 API 必须调用同一套权限逻辑。

不得出现：

```text
网页不能改的数据，AI 却能改
Harbor 不能删的数据，MCP 却可以删
Cat 不能改 Fish 私有数据，但另一个入口可以
```

入口不同，业务权限结果必须一致。

### P7. 高风险规则必须服务端强制

至少包括：

- delete 必须有当前明确删除意图；
- 整体覆盖旧游戏数据必须包含 `确认覆盖游戏数据`；
- owner 数据不得越权；
- command 幂等；
- 图片目录必须与身份匹配；
- 不提供任意 SQL / 任意表写 / 任意 URL fetch。

Prompt 中的安全说明只能作为 UX 辅助，不能作为唯一安全边界。

### P8. Receipt / Tool Result 是业务事实，不以模型自述为准

AI 只能在服务端真实成功后告诉用户：

- 已保存；
- 已修改；
- 已删除；
- 已上传。

Harbor 当前以真实 `RECEIPTS` 为准；未来 MCP 直接以 tool result 为准。

不得因为模型“认为自己做成功了”就视为成功。

### P9. 幂等必须在服务端，不依赖 AI 自律

AI 可能重试、超时、重复提交。

因此 mutation 必须有服务端幂等保护。

Harbor 当前使用：

```text
(actor, command_id)
```

未来 MCP / API 可以使用 request id / idempotency key，但原则不变：

**重复网络请求不能产生重复生活记录。**

### P10. 照片处理属于媒体业务层，不属于 Harbor

长期流程应抽象为：

```text
trusted original
→ identity / ownership validation
→ image processing
→ Supabase Storage
→ canonical record binding
```

当前 Harbor 使用 Google Drive 保存原图只是一个 Adapter 选择。

未来 MCP 如果能直接上传附件，可以替换原图进入方式，但以下规则保留：

- 旋转纠正；
- 最长边约 600px；
- WebP quality 70；
- 超过约 120KB 逐步降质量；
- 最低 quality 55；
- 一般目标约 50～100KB；
- 正式绑定和 ownership 校验。

### P11. 性能优化不能污染业务层

Fast Wake、Drive Watch、轮询都是 Harbor Adapter 的性能机制。

它们不得进入 `life_query / life_mutate` 的业务语义。

未来换 MCP 后，应能直接删除：

```text
Fast Wake
Apps Script polling
Drive Watch
COMMANDS / RECEIPTS transport
```

而业务服务无需修改。

### P12. Project Prompt 不作为 schema 数据库

Project 指令只应保留：

- 当前 Project 的固定身份语义；
- 使用哪个 Adapter / Bridge；
- 基本操作顺序；
- 用户交互风格；
- 必要安全提醒。

以下内容应逐步从 prompt 移出，放进程序：

- 业务字段表；
- 枚举映射；
- schema alias；
- validation；
- 权限细节；
- 默认值；
- 模块能力清单。

目标是未来 AI 换模型时，不需要复制一份巨大的“业务说明书”。

## 4. Adapter Contract

任何 AI Adapter 至少完成四件事：

### 4.1 身份

把可信外部身份转换为：

```text
FixedLifeIdentity(cat | fish)
```

### 4.2 调用

只允许进入稳定 tool registry：

```text
life_capabilities
life_query
life_mutate
```

### 4.3 结果

把 core 返回的结构化结果原样保留关键字段，不自行修改事实。

### 4.4 传输级可靠性

Adapter 自己负责：

- timeout；
- retry；
- wake；
- polling；
- transport auth；
- transport logging。

这些不进入 domain service。

## 5. Business Contract

每个 resource 都必须有可追溯的业务 contract，至少记录：

```text
resource
query actions
mutate actions
input schema
normalized schema
output schema
user-readable labels
permission rule
idempotency rule
error codes
photo/file behavior
examples
```

新增模块（例如 cycle）时正确流程是：

```text
定义 canonical domain service
→ 注册 life_query / life_mutate contract
→ 测试权限 / schema / result
→ Harbor 自动可用
→ MCP 自动可复用
```

而不是分别给 Harbor 和 MCP 写两套业务实现。

## 6. 错误设计原则

错误必须帮助调用方修正，而不是诱导 AI 猜参数。

不推荐：

```text
INVALID_PAYLOAD
```

推荐：

```json
{
  "code": "MEAL_ITEM_NAME_REQUIRED",
  "path": "items[0]",
  "message": "第 1 个食物缺少名称",
  "acceptedFields": ["name", "foodName", "rawName"]
}
```

规则：

- 错误码稳定；
- 错误 path 明确；
- 能程序修复时尽量程序自动 normalization；
- 不把内部数据库错误直接暴露给 AI / 用户。

## 7. 可观测性与调试边界

必须能区分：

```text
AI planning latency
Adapter transport latency
Core execution latency
Database latency
Image processing latency
```

例如 Harbor 目前暴露出的典型问题应分类为：

- Fast Wake 404 / 502 → Adapter / transport；
- ChatGPT 搜网页再 Wake → AI planning / Adapter 调用；
- `rawName` 猜错 → Business Contract / schema；
- `neutral` 被翻译错 → Business semantics；
- cat / fish ownership → Authorization。

任何修复先归类，再决定修改哪一层。

## 8. 测试门槛

影响 AI 接入的每个业务变更至少检查：

1. canonical service 单测；
2. AI Access Core contract 测试；
3. cat / fish 权限隔离；
4. 幂等；
5. 错误结构；
6. Harbor Adapter 回归；
7. 若支持 MCP，则 MCP contract 回归；
8. Production 真实只读 / 最小写入验收（需按部署与数据安全规则执行）。

不能只验证“网页能用”，也不能只验证“团子说成功了”。

## 9. Harbor 的定位与退役边界

Harbor 当前是正式可用入口，但架构上定义为：

**可替换 Adapter，不是长期业务核心。**

未来满足以下条件后可以迁移到 MCP：

- MCP 客户端可稳定获得 cat / fish 身份；
- tool 调用支持所需的读写和附件；
- 权限、幂等、删除安全与 Harbor 等价；
- 图片链路有可靠替代；
- 性能与可用性不低于 Harbor；
- 完成并行验证。

迁移完成后可退役：

```text
Google Sheet COMMANDS / RECEIPTS transport
Apps Script Worker
Drive Watch
Fast Wake
Bridge pairing
transport-specific META
```

但 Google Drive 原图 / 备份是否保留，是存储策略问题，与 Harbor 是否退役无关。

## 10. 开发时的强制判断题

以后每次开发 AI 功能，先回答：

### Q1. 这是 Adapter 问题还是业务问题？

如果换成 MCP 仍然存在，就是业务 / core 问题。

### Q2. 这段逻辑未来 MCP 能直接复用吗？

不能复用且又不是传输逻辑时，优先重构。

### Q3. 这个字段 / 枚举是否应该让 AI 记？

如果程序可以返回或 normalize，就不要写进 prompt。

### Q4. 安全规则是否服务端强制？

如果只存在于 prompt，不算完成。

### Q5. 这次修复有没有留下文字记录？

必须在 AI 接入决策记录中留下：问题、根因层、决定、复用边界、测试结果。

## 11. 当前架构总图

```text
┌──────────────────────────────────────────────┐
│            可替换 AI Entry / Adapter         │
│                                              │
│  Harbor Cat/Fish   MCP   内置AI   第三方API │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                AI Access Core                │
│                                              │
│ identity / auth / schema normalization       │
│ permissions / labels / idempotency / safety  │
│ life_capabilities / life_query / life_mutate │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│             Canonical Life Services          │
│ mood / sleep / activity / meal / weight ...  │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                    Data                      │
│ Supabase DB / Supabase Storage / Drive       │
└──────────────────────────────────────────────┘
```

## 12. 一句话原则

> **AI 可以换，入口可以换，桥可以删；业务 contract、权限、安全、语义和正式数据层必须稳定。**

后续 AI 开发默认以本文件为最高层架构约束；若需要违反其中原则，必须先在决策记录中明确写出原因、替代方案和未来迁移成本。
