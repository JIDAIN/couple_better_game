# Harbor Instructions Maintenance

## Canonical source

Harbor Cat / Harbor Fish 当前可复制的 ChatGPT Project Instructions 统一以：

`docs/46-harbor-mcp-project-instructions.md`

为唯一正文源。

不要再维护 Cat/Fish 两份彼此独立、容易漂移的指令文件；身份差异只保留在同一模板中的固定 OAuth actor 规则。

## 需要同步更新的变化

以下变化发生时，应在同一批修改中检查 `docs/46-harbor-mcp-project-instructions.md`：

- Cat / Fish OAuth 身份或权限语义；
- `life_query / life_mutate` 的调用约定；
- meal 的“聊天草稿 → 用户确认 → 正式写入”行为；
- 图片附件、恢复链接、压缩、旋转、缩放与单图持久化规则；
- mailbox、medicine、activity、未来 cycle 等 domain 的 AI 规则；
- 删除、高风险操作和幂等规则；
- Production 部署授权规则。

## 维护原则

- Project Instructions 只保留身份、入口、必要交互规则和安全边界，不充当 schema 数据库。
- 字段、枚举、默认值和权限细节尽量由 AI Access Core / canonical services 返回和强制。
- 发生冲突时，以生产行为、当前 `main` 代码和当前主文档为准。
- 已退役的历史 transport 只保存在 `docs/archive/` 或 Git 历史，不重新写回当前 Project Instructions。

## 安全要求

Project Instructions 与仓库文档中不得写入 OAuth secret、Supabase service-role key、PushPlus token、私钥或其他长期凭据。
