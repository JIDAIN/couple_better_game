# Harbor Instructions Maintenance

## Canonical source

Harbor Cat / 团子的 **当前可复制 Project Instructions** 以：

- `docs/46-harbor-cat-project-instructions-current.md`

为唯一当前正文源。

`docs/26-harbor-project-skill-playbook.md` 继续保留为 Harbor 架构、历史协议与 Cat/Fish 共用原则说明；当其中的历史描述与 `docs/46-harbor-cat-project-instructions-current.md` 冲突时，以 `docs/46` 的当前正式指令为准。

## 必须同步更新的变更

以后出现以下任一变化时，应在同一批代码/文档修改中检查并更新 `docs/46`：

- Cat/Fish 身份或权限语义；
- COMMAND / Fast Wake / RECEIPT 协议；
- AI Access Core 的 query/mutate 约定；
- meal 的“聊天草稿 → 用户确认 → 正式写入”行为；
- 单图、餐前/餐后多图的摄入估算与正式保存策略；
- meal 图片上传、恢复链接、旋转、缩放、裁切/留白行为；
- mailbox、medicine、未来 cycle 等 domain 的 AI 规则；
- Production 部署授权规则。

## 长度要求

ChatGPT Project 中使用的 Harbor Cat 指令正文必须保持 **少于 8000 字符**。每次修改 `docs/46` 后应重新统计代码块中的正文字符数；如逼近限制，优先压缩重复的解释，不删除身份、权限、幂等、删除安全、meal 草稿、图片或 Production 授权等关键规则。

## 安全要求

Project Instructions 与仓库普通文档中不得写入 HMAC secret、Supabase service role key、Apps Script wake secret、Fast Wake token、私钥或其他长期凭据。
