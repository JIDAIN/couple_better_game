# AI Access Core 架构原则

> 状态：长期架构基线 / 约束性文档  
> 更新：2026-09-06

## 1. 核心目标

AI 入口可以变化，但业务能力和事实层保持稳定：

```text
AI Entry / Adapter（可替换）
        ↓
AI Access Core（长期稳定）
        ↓
Canonical Life Services（长期稳定）
        ↓
Supabase Database / Storage
```

当前主要入口：

```text
ChatGPT Custom MCP → MCP Adapter
程序内置 AI       → Function Calling Adapter
其他 MCP client   → MCP Adapter
```

## 2. AI Access Core

稳定工具面：

```text
life_capabilities
life_query
life_mutate
```

AI Access Core 负责：

- 可信身份解析；
- 权限控制；
- 输入 schema 与自然语言归一化；
- 业务语义标准化；
- 幂等；
- 删除和高风险操作安全；
- 文件 / 图片入口校验；
- 稳定错误码与返回结构；
- 调用 canonical domain services。

Adapter 只负责协议转换、认证上下文和传输，不拥有业务规则。

## 3. Canonical Services + Data

```text
Canonical Life Services
→ Supabase Database
→ Supabase Storage
```

永久原则：

- Supabase Database 是结构化生活数据唯一事实源；
- Supabase Storage 是程序展示图片存储；
- 缓存和 UI read model 必须可重建；
- 入口不得维护第二套业务数据库。

## 4. 不可违反的架构原则

### P1. 业务逻辑不得写进 Adapter

meal 字段、mood 语义、权限、删除安全、图片压缩、数据库结构等必须属于 AI Access Core / canonical services。

### P2. MCP 是 Adapter，不是新业务系统

接入新 MCP client 不应复制 meal、mood、medicine、mailbox 等 CRUD。

### P3. Schema 对 AI 友好

对常见自然字段提供 alias / normalization；错误信息指出可用字段；schema 尽量向后兼容。

### P4. 内部枚举由程序返回用户可读 label

模型不应自行猜测 mood、meal type、activity type、medicine status 等内部 key 的用户语义。

### P5. 身份由服务端决定

```text
Harbor-Cat OAuth  → cat
Harbor-Fish OAuth → fish
```

用户自称、AI 昵称、payload 自报 actor、prompt 文本都不是授权身份来源。

### P6. 所有入口共享同一权限规则

网页、MCP、程序内 AI 和未来 API 的业务权限结果必须一致。

### P7. 高风险规则必须服务端强制

至少包括 delete 明确意图、整体覆盖确认、owner 校验、幂等、图片 ownership 与禁止任意 SQL / 任意表写。

### P8. Tool Result 是业务事实

AI 只能在服务端真实成功后告诉用户“已保存 / 已修改 / 已删除 / 已上传”。模型自述不是成功凭证。

### P9. 幂等在服务端

AI 可能重试、超时、重复提交。重复网络请求不能产生重复生活记录。

### P10. 照片处理属于媒体业务层

```text
trusted original
→ identity / ownership validation
→ EXIF normalize
→ 600px WebP compression
→ Supabase Storage
→ canonical record binding
```

### P11. 性能优化不能污染业务层

prefetch、stale cache、foreground revalidation、MCP transport retry 等机制不能改变 `life_query / life_mutate` 的业务语义。

### P12. Project Prompt 不作为 schema 数据库

Project 指令只保留固定身份语义、使用哪个 MCP、必要交互与安全提醒；业务字段、枚举、validation、权限细节和默认值放进程序。

## 5. Adapter Contract

每个 AI Adapter 至少完成：

1. 将可信外部身份转换为固定身份；
2. 只进入稳定 tool registry；
3. 保留 core 返回的结构化关键事实；
4. 自己处理 timeout / retry / transport auth / logging。

## 6. Business Contract

每个 resource 都应有可追溯 contract：

```text
resource
query actions
mutate actions
input / normalized / output schema
labels
permission rule
idempotency rule
error codes
photo/file behavior
```

新增模块时先定义 canonical domain service 与 `life_query / life_mutate` contract，再由现有 Adapter 自动复用。

## 7. 测试门槛

影响 AI 接入的业务变更至少检查：

1. canonical service 单测；
2. AI Access Core contract；
3. cat / fish 权限隔离；
4. 幂等；
5. 错误结构；
6. MCP contract；
7. Production 真实只读 / 最小写入验收（按部署和数据安全规则执行）。

不能只验证“网页能用”，也不能只验证“AI 说成功了”。
