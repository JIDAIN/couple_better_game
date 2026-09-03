# AI 访问与写入架构

## 1. 总目标

AI 必须能够像当前身份用户一样读取和修改 Couple Better Game，但不能获得任意 SQL / 任意表写权限。

稳定业务能力中心始终是：

```text
life_capabilities
life_query
life_mutate
```

所有 AI 入口最终进入同一个 server-side registry，再调用 canonical service / RPC / Supabase Storage。

## 2. R10 主路径：Harbor Cat / Harbor Fish

R10 主入口是两个 ChatGPT Project：

```text
Harbor Cat  -> cat
Harbor Fish -> fish
```

它们只是同一个共同生活空间的两个 AI 入口：

```text
Harbor Cat                         Harbor Fish
   |                                  |
Cat Google Sheet                 Fish Google Sheet
   |                                  |
Cat Apps Script                  Fish Apps Script
   |                                  |
   +----------- signed HMAC ---------+
                    |
          /api/drive-bridge/*
                    |
       life_query / life_mutate
                    |
      Supabase Database / Storage
```

Google Sheets 不是数据库，只承担：

- `COMMANDS`：ChatGPT 追加的命令；
- `RECEIPTS`：真实执行结果；
- `STATE_*`：Supabase 的只读状态镜像；
- `META`：schema、身份、同步、备份、watch 状态。

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

未来新增 `cycle` 等模块时，只需新增 canonical domain service 并注册 query/mutate；Harbor Project、Bridge 协议、R9 UI 和 MCP 都不需要重新设计。

## 5. 双 Bridge 身份与权限

请求必须携带：

```text
x-life-bridge-id: cat | fish
x-life-bridge-timestamp
x-life-bridge-signature
```

生产环境为 Cat / Fish 分别保存独立：

```text
BRIDGE_SECRET
WATCH_TOKEN
APPS_SCRIPT_URL
APPS_SCRIPT_WAKE_SECRET
ORIGINALS_MEALS_FOLDER_ID
```

服务端先根据 `bridge-id` 选择对应 secret，再验证 HMAC，最后才创建固定身份：

```text
cat  -> FixedLifeIdentity(cat)
fish -> FixedLifeIdentity(fish)
```

Cat secret 无法冒充 Fish；Fish secret 无法冒充 Cat。身份不从 Sheet 单元格、COMMANDS payload 或模型文本中获取。

既有权限继续生效：

- Mood / Sleep / Meal / Weight：owner 服务端强制为当前身份；
- Meal / Weight update/delete：再次核验 ownership；
- Mailbox：sender 固定当前身份、recipient 固定 Ta，不能改删 Ta 发出的信；
- Medicine / Activity：沿用当前共享规则；
- Settings：周年日共享，目标体重只改当前身份；
- delete：`user_text` 必须保留当前用户明确删除意图；
- `legacy_home.replace`：必须包含 `确认覆盖游戏数据`；
- 禁止 `run_sql`、`write_any_table`、`raw_supabase_request`、任意 URL fetch。

## 6. 命令安全与幂等

Apps Script → Vercel 使用：

```text
bodyDigest = SHA256(rawBody)
signature = HMAC-SHA256(secret, timestamp + "." + bodyDigest)
```

Vercel 只接受 5 分钟时钟窗口。

`life_drive_bridge_commands` server-only ledger 使用复合主键：

```text
(actor, command_id)
```

这样两个 Harbor 可以独立生成 UUID，但同一身份的命令不能被重复执行。

规则：

- actor + ID + 相同 payload：返回已有 receipt；
- actor + ID + 不同 payload：拒绝；
- processing 无最终 receipt：不自动盲目重放，优先避免双写；
- Sheet `status` 只是 worker/UI 状态，真正防重复在 Supabase ledger。

## 7. 实时链路

每张 Bridge Sheet 独立建立 Drive file watch：

```text
Google Drive file watch
→ /api/drive-bridge/watch
→ watch token 识别 cat/fish
→ 唤醒对应 Apps Script Web App
→ processPendingCommands()
```

Drive push 只表示“文件发生变化”，所以 worker 仍按 `command_id + status` 扫描实际命令。

两边都保留每 1 分钟一次的 polling fallback。

目标体验：正常几秒级，工程目标约 2～10 秒；push 丢失时退化到约 1 分钟级。Google 不提供严格实时 SLA，因此不能把 2～10 秒写成保证值。

## 8. 原图与展示图

Drive 原图按身份分目录：

```text
Harbor Cat  -> Originals/Meals/Cat
Harbor Fish -> Originals/Meals/Fish
```

流程：

```text
ChatGPT 原图
→ actor-specific Google Drive folder（不压缩）
→ fileId
→ Vercel Service Account drive.readonly
→ 服务端校验 file parent 必须与 bridge identity 匹配
→ Sharp rotate + 600px + WebP q70/65/60/55
→ Supabase Storage
→ meals.photo_path
```

网页手动上传仍限制 10MB；Drive trusted-original 压缩通道允许到 25MB。

Google Drive 保留原始母版；Supabase Storage 只放程序显示所需的轻量 WebP。

## 9. Drive 灾备只保留一份

两个 Project 不意味着两份 backup。

```text
Harbor Cat  = backup leader
Harbor Fish = backup follower
```

只有 Cat worker 定时保存：

```text
get_life_full_export + settings + legacy_home
→ Backups/Daily/YYYY-MM-DD.json
```

每月 1 日额外保存：

```text
Backups/Monthly/YYYY-MM.json
```

`get_life_full_export` 包含 `user + config`，备份单位是整个家庭空间。

Drive 还长期保存双方餐食原图。压缩图可以从原图重建；旧历史压缩照片若没有原图，后续一次性归档到 `Backups/Legacy-Photos`。

GitHub 只保存代码、文档、migration、测试，不保存真实生活数据和照片。

## 10. Project Skill 与人格层

两个 Project 的数据操作 skill 必须共用一套规则，例如：

```text
identity
life-data-read
life-data-write
meal-photo
medicine
mailbox
delete-safety
backup-awareness
future-domain-extension
```

但 Project-local personality 可以不同：

```text
AI name
称呼方式
语言风格
回答长度
活泼/冷静程度
提醒方式
Project 内长期习惯
```

人格层只能改变交互体验，不能改变身份映射、权限、删除确认、数据事实源或 HMAC 安全规则。

## 11. R9 内置 AI 的图片规则

R9 `/ai` 和网页手动上传仍复用默认压缩限制：

```text
原图 <= 10MB
rotate
最长边 600px
WebP q70
>120KB → q65 → q60 → q55
```

R10 的 25MB 只用于已在 Drive 中的可信原图读取通道，不放宽普通 HTTP 上传入口。

## 12. 新 Domain 接入规范

新增例如 `cycle`：

1. 建表/约束；
2. 建 canonical server service / RPC；
3. 明确 owner / household 权限；
4. 注册 `life_query / life_mutate`；
5. 更新 `life_capabilities`；
6. 增加权限与幂等测试；
7. `get_life_full_export` 若应纳入完整备份则一并扩展；
8. 如需方便 Project 查询，可增加 `STATE_CYCLE` 镜像 tab。

不需要重新设计 Harbor Bridge 协议。

## 13. Production 边界

R10 代码、Drive 文件夹、两张 Bridge Sheet 可以在不部署 Vercel 的情况下开发。

真正激活仍需要：

- Google Cloud Service Account + Drive API；
- Cat/Fish 原图目录只读分享；
- 两个 Apps Script 实例 + Script Properties；
- R10 Supabase migration；
- Cat/Fish R10 Vercel env；
- 用户明确批准一次 Production deployment；
- Harbor Cat / Harbor Fish 真实 ChatGPT Project 端到端验收。

在这些步骤完成前，文档必须写“R10 未 Production 验证”，不能声称两个 Project 已经能真实写回程序。
