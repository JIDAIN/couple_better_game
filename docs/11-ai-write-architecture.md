# AI 访问与写入架构

## 1. 总目标

AI 必须能够像当前登录用户一样读取和修改 Couple Better Game，但不能获得任意 SQL / 任意表写权限。

当前稳定业务能力中心仍然是：

```text
life_capabilities
life_query
life_mutate
```

所有 AI 入口最终都必须进入同一个 server-side registry，再调用 canonical service / RPC / Supabase Storage。

## 2. R10 主路径：ChatGPT Project × Google Drive Bridge

R10 的主目标不是“程序里有一个 AI”，而是：**ChatGPT Plus 中固定 Project 的任意新聊天都能通过已连接的 Google Drive / Google Sheets App 访问程序。**

```text
ChatGPT Project（固定身份）
↓ Google Drive / Sheets App
Couple Better Game AI Bridge Sheet
↓
Apps Script Worker
↓ HMAC
/api/drive-bridge/execute
/api/drive-bridge/snapshot
↓
life_query / life_mutate
↓
Supabase Database / Storage
```

Google Sheets 不是数据库，只承担：

- `COMMANDS`：ChatGPT 追加的命令；
- `RECEIPTS`：真实执行结果；
- `STATE_*`：Supabase 的只读状态镜像；
- `META`：schema、同步、备份、watch 状态。

Supabase 继续是唯一事实源。

完整设计见 `docs/25-r10-chatgpt-project-drive-bridge.md`。

## 3. R9 / R8 的位置

R9 `/ai` 保留为程序内置备用入口：

```text
已登录 cat/fish
→ /ai
→ /api/ai/chat
→ Vercel AI Gateway
→ life-agent-registry
```

R8 `/mcp` 保留为未来支持完整自定义 MCP 的客户端入口：

```text
外部 MCP client
→ OAuth 2.1 / PKCE
→ /mcp
→ canonical services
```

三条路径共享业务权限层，不复制 CRUD。

## 4. 稳定 Tool Registry

查询资源：

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

修改资源：

```text
mood       upsert
sleep      upsert
activity   create / update / delete
meal       create / update / delete + photo
weight     create / update / delete
medicine   create / update / delete
mailbox    create / update / delete
settings   update
legacy_home replace
```

未来新增 `cycle` 等模块时，只需新增 canonical domain service 并注册 query/mutate；ChatGPT Project、Bridge 协议、R9 UI 和 MCP 都不需要重新设计。

## 5. R10 身份与权限

一个 Bridge 固定绑定一个真实身份。

当前主 Bridge：

```text
LIFE_DRIVE_BRIDGE_ACTOR=cat
```

因此 Project 中：

```text
我 = cat
Ta = fish
```

身份不从 Google Sheet 的任意单元格读取，避免模型通过写 `actor=fish` 冒充 Ta。

既有权限继续生效：

- Mood / Sleep / Meal / Weight：owner 服务端强制为当前身份；
- Meal / Weight update/delete：再次核验 ownership；
- Mailbox：sender 固定当前身份、recipient 固定 Ta，不能改删 Ta 发出的信；
- Medicine / Activity：沿用当前共享规则；
- Settings：周年日共享，目标体重只改当前身份；
- delete：`user_text` 必须保留当前用户明确删除意图；
- `legacy_home.replace`：必须包含 `确认覆盖游戏数据`；
- 禁止 `run_sql`、`write_any_table`、`raw_supabase_request`、任意 URL fetch。

## 6. R10 命令安全与幂等

Apps Script → Vercel 不使用用户密码，而使用独立 HMAC：

```text
bodyDigest = SHA256(rawBody)
signature = HMAC-SHA256(secret, timestamp + "." + bodyDigest)
```

请求携带：

```text
x-life-bridge-timestamp
x-life-bridge-signature
```

Vercel 只接受 5 分钟时钟窗口。

此外新增 `life_drive_bridge_commands` server-only ledger，以 `command_id` 为主键：

- 第一次命令先 claim，再执行；
- 相同 ID + 相同 payload 返回已有 receipt；
- 相同 ID + 不同 payload 拒绝；
- 若崩溃后停在 processing，不自动重放，优先避免双写。

因此 Sheet 的 `status` 只是 UI/worker 状态，真正的防重复在 Supabase server-only ledger。

## 7. 实时链路

主链路：Google Drive file watch → `/api/drive-bridge/watch` → 唤醒 Apps Script → 扫描 `COMMANDS`。

Drive push 只表示“文件发生变化”，所以 Apps Script 仍按 `command_id + status` 扫描实际命令。

兜底：Apps Script 每 1 分钟运行一次 `processPendingCommands()`。

目标：正常几秒级，工程目标约 2～10 秒；push 丢失时退化到约 1 分钟级。Google 不提供严格实时 SLA，因此不能把 2～10 秒写成保证值。

## 8. 原图与展示图

R10 ChatGPT 餐食照片：

```text
ChatGPT 原图
→ Google Drive / Originals / Meals（不压缩）
→ fileId
→ Vercel Service Account drive.readonly
→ 下载原图
→ Sharp rotate + 600px + WebP q70/65/60/55
→ Supabase Storage
→ meals.photo_path
```

网页手动上传仍限制 10MB；Drive trusted-original 压缩通道允许到 25MB。

Service Account 只能读取专门分享的 `Originals/Meals`，代码还会再次校验 direct parent、MIME type、trashed 状态。

Google Drive 保留原始母版；Supabase Storage 只放程序显示所需的轻量 WebP。

## 9. Drive 灾备

Apps Script 每天保存：

```text
life_export + settings + legacy_home
→ Backups/Daily/YYYY-MM-DD.json
```

每月 1 日额外保存：

```text
Backups/Monthly/YYYY-MM.json
```

Drive 还长期保存餐食原图。压缩图可以从原图重建；旧历史压缩照片若没有原图，后续一次性归档到 `Backups/Legacy-Photos`。

GitHub 只保存代码、文档、migration、测试，不保存真实生活数据和照片。

## 10. R9 内置 AI 的图片规则

R9 `/ai` 和网页手动上传仍复用默认压缩限制：

```text
原图 <= 10MB
rotate
最长边 600px
WebP q70
>120KB → q65 → q60 → q55
```

R10 的 25MB 只用于已在 Drive 中的可信原图读取通道，不放宽普通 HTTP 上传入口。

## 11. 新 Domain 接入规范

新增例如 `cycle`：

1. 建表/约束；
2. 建 canonical server service / RPC；
3. 明确 owner / household 权限；
4. 注册 `life_query / life_mutate`；
5. 更新 `life_capabilities`；
6. 增加权限与幂等测试；
7. `life_export` 若应纳入完整备份则一并扩展。

Bridge Sheet 不需要新增“新的 AI 接口”；最多增加一个便于阅读的 `STATE_CYCLE` 镜像 tab。

## 12. Production 边界

R10 代码、Drive 文件夹、Bridge Sheet 可以在不部署 Vercel 的情况下开发。

真正激活仍需要：

- Google Cloud Service Account + Drive API；
- `Originals/Meals` 只读分享；
- Apps Script Project + Script Properties；
- R10 Supabase migration；
- R10 Vercel env；
- 用户明确批准一次 Production deployment；
- 真实 ChatGPT Project 端到端验收。

在这些步骤完成前，文档必须写“R10 未 Production 验证”，不能声称 Project 任意聊天已经能真实写回程序。
