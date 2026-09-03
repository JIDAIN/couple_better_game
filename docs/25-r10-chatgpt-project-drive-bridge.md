# R10：ChatGPT Project × Google Drive 双向桥与灾备

## 1. 目标

R10 的唯一主目标是：不升级 ChatGPT 套餐，在一个固定 ChatGPT Project 中，任意新聊天窗口都能通过已经连接的 Google Drive / Google Sheets App 读取并修改 Couple Better Game。

R10 不把 Google Sheets 当数据库。事实源仍然是 Supabase；Sheet 只是 ChatGPT 可读写的命令总线与只读状态镜像。

```text
ChatGPT Project（固定身份：cat）
        ↓ Google Drive / Sheets App
Couple Better Game AI Bridge Sheet
        ↓
Apps Script Worker
        ↓ HMAC
Vercel /api/drive-bridge/*
        ↓
life_query / life_mutate
        ↓
Supabase Database + Storage
```

R9 的程序内 `/ai` 与 R8 `/mcp` 保留为备用入口，但不再是个人 Plus 方案的主路径。

## 2. 可行性结论

### 2.1 已验证可行

- 当前 ChatGPT 账号已经连接 Google Drive，并具备 Google Sheets 的读取与写入动作；
- Google Sheet 可以作为追加式 `COMMANDS` 总线；
- Google Drive API 支持文件变化 push notification；
- Google Apps Script 支持 1 分钟时间触发器，可作为 webhook 丢失时的兜底；
- Apps Script 可以调用 Vercel HTTPS API；
- Vercel 可以复用 R9 的 `life_query / life_mutate`，无需复制业务规则；
- 原图可以先进入 Drive，再由 Vercel 通过 Drive API 下载并使用现有 Sharp 压缩器生成程序展示图；
- Supabase 完整 V2 export 可作为 Drive 每日/每月 JSON 备份源。

### 2.2 仍需生产端验收

以下项目只有在 R10 Production 激活后才能真实验证：

1. ChatGPT Project 新建多个聊天时是否稳定继承 Google Drive App 调用习惯；
2. ChatGPT 是否能按 Project Instructions 正确追加 `COMMANDS`，而不是直接改 `STATE_*`；
3. Drive push notification 的实际到达延迟；
4. Apps Script Web App、Drive watch 与 Vercel webhook 的真实互通；
5. Service Account 对 `Originals/Meals` 的只读下载；
6. 一张真实手机原图从 Drive → 600px WebP → Supabase Storage → 程序显示的完整链路。

因此 R10 在部署前只能标记为“代码/架构可行”，不能标记为“Production 已验证”。

## 3. 已创建 Google Drive 结构

根目录：`Couple Better Game`

```text
Couple Better Game/
├─ AI-Bridge/
│  ├─ Couple Better Game AI Bridge（Google Sheet）
│  ├─ Archive/
│  ├─ Scripts/
│  ├─ Temp/
│  ├─ Snapshots/
│  └─ Logs/
├─ Originals/
│  └─ Meals/
├─ Backups/
│  ├─ Daily/
│  ├─ Monthly/
│  ├─ Legacy-Photos/
│  ├─ Recovery/
│  └─ Exports/
└─ Trash/
   ├─ Photos/
   └─ Data/
```

Bridge Sheet：

- ID：`1inEL4mXOQ2-w5UrkqtLoK6aU2o-4auCQSLlEGuA3cVo`
- URL：`https://docs.google.com/spreadsheets/d/1inEL4mXOQ2-w5UrkqtLoK6aU2o-4auCQSLlEGuA3cVo/edit`
- 时区：`Asia/Shanghai`

关键文件夹：

- Drive root：`11X4-Ge20uRm4z7ioALs2Kz6BTQNv25J8`
- AI-Bridge：`1tzEsJIKTHIYp4yh_5M8Iu7fjDAQJUvHu`
- Originals：`1RkOV-9ospJge9d7yu141yC1844I2Ig5C`
- Originals/Meals：`1nyDWkdE67xPgCSee4WC937PLxO2wuGcg`
- Backups/Daily：`1DmBM6Pfo7fUlhXnOpDwr8eingWiJCkpK`
- Backups/Monthly：`1qU5floe7ORg-KbfAPR9h55TmijgSfjGP`
- Trash：`1EvWd3za_9m25yOhgDDwSp-q8ukM33lgV`

这些 ID 不是密码；真正的 HMAC secret、Service Account private key 不进入 GitHub。

## 4. Bridge Sheet 设计

### 4.1 控制页

- `README`：AI 与人工都可读的操作规则；
- `META`：schema version、绑定身份、同步时间、备份时间、watch 状态；
- `COMMANDS`：ChatGPT 只能在这里追加写命令；
- `RECEIPTS`：程序执行后的回执；
- `ASSETS`：Drive 原图和程序记录的映射辅助表。

### 4.2 状态镜像

- `STATE_MOOD`
- `STATE_SLEEP`
- `STATE_ACTIVITY`
- `STATE_MEALS`
- `STATE_MEAL_ITEMS`
- `STATE_WEIGHT`
- `STATE_MEDICINE`
- `STATE_MAILBOX`
- `STATE_SETTINGS`
- `STATE_PARTNERS`
- `STATE_LEGACY`

`STATE_*` 是 Supabase 快照，不是事实源，ChatGPT 不得直接修改这些 Sheet 来假装程序数据已经改变。

## 5. 身份模型

当前 R10 Bridge 固定绑定：

```text
LIFE_DRIVE_BRIDGE_ACTOR=cat
```

因此：

```text
ChatGPT Project 中的“我” = cat
Ta = fish
```

Apps Script 发来的命令不能携带一个可被信任的 `actor` 来切换身份。Vercel 根据环境变量固定生成 `FixedLifeIdentity`，继续复用 R9 的权限规则。

如果未来 fish 也要使用独立 ChatGPT Project，应复制一套 Bridge，并把另一套 Production Bridge 固定绑定 fish，而不是在同一张 Sheet 中允许 AI 自选身份。

## 6. COMMANDS 协议

列：

```text
command_id
created_at
tool
args_json
user_text
original_drive_file_id
original_file_name
original_mime_type
status
processed_at
error
```

`tool` 只能是：

```text
life_capabilities
life_query
life_mutate
```

示例：记录体重

```json
{
  "commandId": "UUID",
  "tool": "life_mutate",
  "args": {
    "resource": "weight",
    "action": "create",
    "payload": {
      "measurementDate": "2026-09-03",
      "weightKg": 63.4
    }
  },
  "userText": "我今天63.4kg，帮我记一下"
}
```

删除、旧游戏覆盖等操作必须把用户原话保存在 `user_text`，因为最终安全判断在 Vercel 端再次执行。

## 7. 持久幂等账本

只靠 Sheet 的 `status` 不够安全。

风险：

```text
Supabase 写入成功
→ 网络断开
→ Sheet 没收到回执
→ 下一分钟再次执行
→ 可能重复新增
```

R10 新增 server-only 表：

```text
life_drive_bridge_commands
```

以 `command_id` 为主键，记录：actor、tool、request hash、processing/succeeded/failed、receipt。

规则：

- 相同 command ID + 相同 payload：成功/失败回执直接复用，不重复执行；
- 相同 command ID + 不同 payload：拒绝；
- 命令已经进入 `processing` 但没有最终回执：不自动重放，避免双写；
- AI 修正失败命令时必须产生新的 command ID。

该表不是生活数据事实源，只是桥接幂等/审计账本。

## 8. 实时通知与延迟

主通道：

```text
ChatGPT 写 COMMANDS
↓
Google Drive file watch
↓ push notification
/api/drive-bridge/watch
↓
Vercel 验证 x-goog-channel-token
↓
唤醒 Apps Script Web App
↓
processPendingCommands()
↓
/api/drive-bridge/execute
```

目标体验：正常几秒级，工程目标约 2～10 秒；Google 不保证严格实时，因此不能承诺硬 SLA。

兜底：Apps Script 每 1 分钟运行 `processPendingCommands`。若 webhook 丢失，命令仍会在后续轮询中被发现。

Drive watch 有有效期，脚本每 6 小时检查并在临近过期时自动续订；旧 channel 尽可能主动 stop。

## 9. 原图与程序展示图

### 9.1 ChatGPT 上传餐食照片

```text
聊天原图
↓ 原封不动上传
Google Drive / Originals / Meals
↓ fileId
COMMANDS.original_drive_file_id
↓
Vercel Service Account（只读指定文件夹）
↓
下载原图
↓
Sharp
rotate
最长边 600px
WebP q70
>120KB → 65 → 60 → 55
↓
Supabase Storage meal-photos
↓
数据库只保存 photo_path
```

Google Drive 原图不做 resize、不改编码、不降质量。

网页手动上传仍保持 10MB 输入限制；可信 Drive 原图压缩通道单独允许最多 25MB，避免正常高像素手机原图因为网页入口限制而失败。

### 9.2 安全范围

Vercel 的 Google Service Account 只申请 `drive.readonly`，并在代码中再次校验原图必须直接位于配置的 `Originals/Meals` 文件夹，非图片、已进垃圾桶或其他 Drive 文件一律拒绝。

## 10. 数据备份

Apps Script 每天获取：

```text
get_life_export
+ settings
+ legacy_home
```

并保存为：

```text
Backups/Daily/YYYY-MM-DD.json
```

每月 1 日同时写：

```text
Backups/Monthly/YYYY-MM.json
```

Drive 保留：

- 完整结构化 JSON 备份；
- 原始餐食照片；
- 旧照片迁移后的 legacy archive（后续一次性任务）。

Supabase Storage 中的压缩图不必永久重复备份，因为可以用 Drive 原图和同一压缩器重建。旧历史照片如果不存在原图，应一次性复制到 `Backups/Legacy-Photos`。

## 11. 服务端接口

```text
POST /api/drive-bridge/execute
POST /api/drive-bridge/snapshot
POST /api/drive-bridge/watch
```

`execute` / `snapshot`：

- Apps Script 对 raw body 做 SHA-256；
- 签名串 `${timestamp}.${bodyDigest}`；
- HMAC-SHA256 + base64url；
- headers：`x-life-bridge-timestamp`、`x-life-bridge-signature`；
- Vercel 允许最大 5 分钟时钟偏差。

`watch`：验证 Google channel token 后再唤醒 Apps Script。

## 12. Production 环境变量

激活 R10 时需要：

```text
LIFE_DRIVE_BRIDGE_SECRET=<随机独立 secret>
LIFE_DRIVE_BRIDGE_ACTOR=cat
LIFE_DRIVE_WATCH_TOKEN=<随机独立 token>
LIFE_DRIVE_APPS_SCRIPT_URL=<部署后的 Apps Script Web App URL>
LIFE_DRIVE_APPS_SCRIPT_WAKE_SECRET=<随机独立 secret>
LIFE_DRIVE_SERVICE_ACCOUNT_EMAIL=<Google Service Account>
LIFE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY=<private key>
LIFE_DRIVE_ORIGINALS_MEALS_FOLDER_ID=1nyDWkdE67xPgCSee4WC937PLxO2wuGcg
```

这些 secret 不写进 Google Sheet、GitHub 或 Project Instructions。

Apps Script Script Properties：

```text
BRIDGE_SECRET=<与 LIFE_DRIVE_BRIDGE_SECRET 相同>
WATCH_TOKEN=<与 LIFE_DRIVE_WATCH_TOKEN 相同>
WAKE_SECRET=<与 LIFE_DRIVE_APPS_SCRIPT_WAKE_SECRET 相同>
```

## 13. ChatGPT Project Instructions（生产激活后使用）

建议 Project 名：`🐟🐱生活`

```text
这是 Couple Better Game 的生活管理 Project。本 Project 固定代表 cat：我=cat，Ta=fish。

涉及程序中的事实时，优先使用已连接的 Google Drive App 读取“Couple Better Game AI Bridge”中的 STATE_*，不要用聊天记忆猜数据库事实。

STATE_* 是只读镜像，绝对不要直接修改 STATE_* 来代表程序写入。

当我明确要求新增、记录、修改或删除程序数据时：
1. 在 AI Bridge 的 COMMANDS 末尾追加一行；
2. command_id 使用全新的 UUID；
3. created_at 写当前 ISO 时间；
4. tool 只能写 life_query / life_mutate / life_capabilities；
5. args_json 写合法 JSON；
6. user_text 必须保留我当前这句话的原意；删除操作必须保留明确的“删除/移除”等原始表述；
7. status 写 pending；
8. 不要改已有 command_id，也不要重用失败命令的 command_id；
9. 写入后检查 RECEIPTS 或刷新后的 STATE_*，确认程序真正执行成功后再告诉我“已记录/已修改/已删除”。

如果我发送餐食照片并要求记录：
1. 先把原图原封不动上传到 Google Drive 的 Couple Better Game/Originals/Meals；
2. 不要压缩、重编码或降低原图质量；
3. 获取该 Drive 文件的 fileId；
4. 追加 meal 的 life_mutate 命令，args_json 中 attachPhoto=true，同时在 original_drive_file_id 写入该 fileId；
5. 等 RECEIPTS 成功后再确认记录完成。程序会自行生成 600px WebP 展示图。

我只是询问或讨论时不要写 COMMANDS。涉及 Ta 的个人记录时遵守程序权限：可以查询允许查看的数据，不冒充 Ta 修改 Ta 的个人数据。
```

## 14. 激活与验收顺序

R10 代码合并到 main 后仍不等于上线。正式激活必须按以下顺序：

1. 创建 Google Cloud Service Account，启用 Drive API；
2. 把 `Originals/Meals` 只读分享给 Service Account；
3. 创建 Apps Script Project，复制 `scripts/google-apps-script/r10-drive-bridge/`；
4. 设置 Script Properties 三个 secret；
5. 部署 Web App（execute as owner），记录 URL；
6. 执行 Supabase R10 migration；
7. 在 Vercel Production 配置 R10 env；
8. **取得用户明确 Vercel Production 部署许可后**才部署；
9. Apps Script 执行一次 `setupR10Triggers()`；
10. 在 ChatGPT `🐟🐱生活` Project 填入上述 Instructions；
11. 依次验收：查询药箱 → 新增无害测试记录 → 修改 → 删除 → 跨新聊天查询 → 真实餐食原图 → Drive backup → webhook 延迟 → 1 分钟 fallback；
12. 验收后更新 `docs/09-status-roadmap.md` 的部署 ID 与测试结果。

## 15. 免费额度与降级

R10 的设计面向两人私用，调用量远低于 Vercel Hobby、Apps Script、Drive API 与 Supabase Free 的常规免费额度。

主要长期容量变量是 Google 账号的 Drive/Gmail/Photos 共用存储空间。后续应加容量提醒：70% 提示、85% 警告。

若 push notification 临时失效：退化到 1 分钟轮询；若 Apps Script 暂时失败：Sheet 中 `pending` 命令不会凭空变成已成功；若 Supabase 写入后回执链路中断：durable ledger 阻止自动重复执行。
