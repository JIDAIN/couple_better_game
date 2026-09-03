# R10：Harbor Cat / Harbor Fish × Google Drive 双向桥与灾备

## 1. 最终目标

R10 的正式入口不是程序内 `/ai`，而是两个 ChatGPT Project：

```text
Harbor Cat  -> 固定身份 cat
Harbor Fish -> 固定身份 fish
```

两个 Project 访问的是**同一个 Couple Better Game、同一个 Supabase、同一个共同生活空间**。它们不是两个岛，也不是两份数据库，只是两个身份固定的 AI 港口。

```text
Harbor Cat                         Harbor Fish
   |                                  |
Cat Bridge Sheet                 Fish Bridge Sheet
   |                                  |
Cat Apps Script                  Fish Apps Script
   |                                  |
   +------------- Vercel -------------+
                    |
          life_query / life_mutate
                    |
          Supabase Database/Storage
                    |
            one shared life space
```

R9 `/ai` 与 R8 `/mcp` 保留为备用能力层；R10 复用 R9 的 canonical tool registry 和权限规则。

## 2. 数据管理原则

永久遵守以下优先级：

```text
Supabase Database = 唯一结构化事实源
Supabase Storage  = 程序展示用压缩照片
Google Drive      = ChatGPT Bridge + 原图档案 + 灾备
Google Sheets     = 命令总线 + 可重建状态镜像
GitHub            = 代码 / migration / 文档 / 测试
```

禁止把 `STATE_*`、Drive backup 或 GitHub 当成第二数据库。

## 3. 双 Project 身份模型

### Harbor Cat

```text
我 = cat
Ta = fish
bridge_id = cat
```

### Harbor Fish

```text
我 = fish
Ta = cat
bridge_id = fish
```

身份不允许由模型、COMMANDS 的 payload 或用户文字自行切换。

Apps Script 每个实例持有自己的 `BRIDGE_ID` 和 `BRIDGE_SECRET`；请求带：

```text
x-life-bridge-id
x-life-bridge-timestamp
x-life-bridge-signature
```

Vercel 根据 `x-life-bridge-id` 选择对应 secret，验证 HMAC 后才创建固定 `FixedLifeIdentity`。

因此 Cat secret 无法签成 Fish；Fish secret 也无法签成 Cat。

## 4. Google Drive 正式目录

```text
Couple Better Game/
├─ AI-Bridge/
│  ├─ Cat/
│  │  └─ Couple Better Game AI Bridge - Cat
│  ├─ Fish/
│  │  └─ Couple Better Game AI Bridge - Fish
│  └─ Archive / Scripts / Temp / Snapshots / Logs
├─ Originals/
│  └─ Meals/
│     ├─ Cat/
│     └─ Fish/
├─ Backups/
│  ├─ Daily/
│  ├─ Monthly/
│  ├─ Legacy-Photos/
│  ├─ Recovery/
│  └─ Exports/
└─ Trash/
```

### 已创建资源

Cat Bridge Sheet：

```text
1inEL4mXOQ2-w5UrkqtLoK6aU2o-4auCQSLlEGuA3cVo
```

Fish Bridge Sheet：

```text
1OsRnN8vC6yDetxaymVmafMEwTADashyjm9BsHqwDobs
```

AI-Bridge/Cat：

```text
1PGvX4N2nUeUtBFpC6oFTq22qxkrmU8Fd
```

AI-Bridge/Fish：

```text
1sfOcySr_4VBte4PHz21B3Thg3FaBQzgx
```

Originals/Meals/Cat：

```text
1w3gPsOT64O9YZwmdFidboc0-MD2geAc4
```

Originals/Meals/Fish：

```text
1UOHJeodhzdtXhUWIqpOEzwoehseglHst
```

Daily/Monthly backup 仍然各只有一套，不按用户复制。

## 5. 两张 Bridge Sheet

两张 Sheet 结构一致：

```text
README
META
COMMANDS
RECEIPTS
STATE_MOOD
STATE_SLEEP
STATE_ACTIVITY
STATE_MEALS
STATE_MEAL_ITEMS
STATE_WEIGHT
STATE_MEDICINE
STATE_MAILBOX
STATE_SETTINGS
STATE_PARTNERS
STATE_LEGACY
ASSETS
```

区别只有固定身份、Project 名、原图目录和独立凭证。

`META.schema_version`：

```text
r10-v2
```

Cat：

```text
project_name = Harbor Cat
bridge_id = cat
bound_actor = cat
backup_role = leader
```

Fish：

```text
project_name = Harbor Fish
bridge_id = fish
bound_actor = fish
backup_role = follower
```

## 6. STATE_* 与正式数据的关系

两张 Bridge 都可以拥有相同的家庭状态快照，例如双方体重、共同药箱、信箱等可查看数据。

但：

```text
STATE_* = read model / cache
Supabase = truth
```

直接手工改 `STATE_WEIGHT` 不会修改程序体重。

只有：

```text
COMMANDS -> Apps Script -> signed Vercel API -> life_mutate -> Supabase
```

才算真正写入。

## 7. COMMANDS 协议

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

允许工具：

```text
life_capabilities
life_query
life_mutate
```

删除和高风险覆盖必须保留用户当前原话到 `user_text`，服务端继续执行 R9 的删除意图 / `确认覆盖游戏数据` 校验。

## 8. 双身份持久幂等

R10 ledger 主键改为：

```text
(actor, command_id)
```

而不是全局只有 `command_id`。

这样 Harbor Cat 和 Harbor Fish 即使极端情况下生成相同 UUID，也不会互相占用；但同一个 actor 内重复 command ID 仍会被严格去重。

规则：

- actor + command ID + 相同 payload：复用已有 receipt；
- actor + command ID + 不同 payload：拒绝；
- processing 无最终 receipt：不盲目自动重放，优先避免双写；
- 修正失败命令必须新建 command ID。

## 9. 实时通知与兜底

每张 Bridge Sheet 独立建立 Drive file watch。

```text
Sheet changed
-> Google Drive push notification
-> /api/drive-bridge/watch
-> 根据 watch token 识别 cat / fish
-> 唤醒对应 Apps Script Web App
-> processPendingCommands()
```

正常目标体验：约 2～10 秒，但 Google 不提供严格实时 SLA。

每个 Bridge 同时保留每分钟 `processPendingCommands` 时间触发器，因此 webhook 偶发丢失时仍有约一分钟级兜底。

watch 每 6 小时检查，临近过期自动续订。

## 10. 原始照片

### Harbor Cat

```text
ChatGPT 原图
-> Originals/Meals/Cat
-> original_drive_file_id
-> Cat Bridge command
```

### Harbor Fish

```text
ChatGPT 原图
-> Originals/Meals/Fish
-> original_drive_file_id
-> Fish Bridge command
```

Vercel Service Account 使用 `drive.readonly`，服务端再次验证：

```text
Cat 请求的 fileId 必须直接属于 Cat 原图目录
Fish 请求的 fileId 必须直接属于 Fish 原图目录
```

不能跨目录借 fileId 绕过身份。

Drive 原图：不压缩、不重编码、不降质量。

程序展示版：

```text
EXIF rotate
最长边 600 px
WebP q70
>120KB -> q65 -> q60 -> q55
最低 q55
```

网页普通上传仍限制 10MB；可信 Drive 原图压缩通道最多 25MB。

## 11. 备份只保留一份

不能让两个 Apps Script 都每天生成同一个家庭备份。

因此：

```text
Harbor Cat  = backup leader
Harbor Fish = backup follower
```

只有 Cat worker 创建：

```text
Backups/Daily/YYYY-MM-DD.json
Backups/Monthly/YYYY-MM.json
```

备份单位是整个 `couple-better-game` 家庭空间，不是 cat/fish 两个账号。

snapshot 使用：

```text
get_life_full_export
+ settings
+ legacy_home
```

其中 `get_life_full_export` 包含：

```text
user + config
```

因此 Drive 灾备是一份完整家庭结构化数据，而不是只备份某个人。

原始照片本身已在共享 `Originals` 目录，不再复制一份到 Daily backup。

## 12. Apps Script 同一代码、两套实例

代码只维护一份：

```text
scripts/google-apps-script/r10-drive-bridge/Code.gs
```

Cat Script Properties：

```text
BRIDGE_ID=cat
SHEET_ID=1inEL4mXOQ2-w5UrkqtLoK6aU2o-4auCQSLlEGuA3cVo
BRIDGE_SECRET=<cat secret>
WATCH_TOKEN=<cat watch token>
WAKE_SECRET=<cat wake secret>
BACKUP_LEADER=true
```

Fish：

```text
BRIDGE_ID=fish
SHEET_ID=1OsRnN8vC6yDetxaymVmafMEwTADashyjm9BsHqwDobs
BRIDGE_SECRET=<fish secret>
WATCH_TOKEN=<fish watch token>
WAKE_SECRET=<fish wake secret>
BACKUP_LEADER=false
```

两个实例都同步 STATE、处理 COMMANDS、维护自己的 watch；只有 leader 创建灾备。

## 13. Production 环境变量

生产激活时需要：

```text
LIFE_DRIVE_CAT_BRIDGE_SECRET
LIFE_DRIVE_CAT_WATCH_TOKEN
LIFE_DRIVE_CAT_APPS_SCRIPT_URL
LIFE_DRIVE_CAT_APPS_SCRIPT_WAKE_SECRET
LIFE_DRIVE_CAT_ORIGINALS_MEALS_FOLDER_ID=1w3gPsOT64O9YZwmdFidboc0-MD2geAc4

LIFE_DRIVE_FISH_BRIDGE_SECRET
LIFE_DRIVE_FISH_WATCH_TOKEN
LIFE_DRIVE_FISH_APPS_SCRIPT_URL
LIFE_DRIVE_FISH_APPS_SCRIPT_WAKE_SECRET
LIFE_DRIVE_FISH_ORIGINALS_MEALS_FOLDER_ID=1UOHJeodhzdtXhUWIqpOEzwoehseglHst

LIFE_DRIVE_SERVICE_ACCOUNT_EMAIL
LIFE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY
```

所有 secret/private key 只能进入 Vercel env 或 Apps Script Script Properties，不能进入 GitHub、Sheet 单元格、Project Instructions 或普通聊天。

## 14. Project Instructions 与 AI 人格

两个 Project 的**数据操作技能规则**应保持一致，但 AI 人格可以完全不同。

共享 skill / playbook 至少包含：

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

Harbor Cat 的 Project Instructions 固定引用 Cat Bridge 和 Cat 原图目录；Harbor Fish 固定引用 Fish Bridge 和 Fish 原图目录。

人格层则独立：

```text
AI name
说话风格
称呼
回答长度
是否活泼/冷静
对提醒的方式
长期形成的 Project 内习惯
```

不能因为人格不同而修改共同的数据安全规则。

## 15. 仍需 Production 验收

当前双 Project 结构和 Drive 资源已建立，但在生产激活前仍不能声称真实端到端可用。

最终验收包括：

1. Harbor Cat 多个新聊天都能读 Cat Bridge；
2. Harbor Fish 多个新聊天都能读 Fish Bridge；
3. Cat 写自己的记录成功；
4. Fish 写自己的记录成功；
5. Cat 尝试冒充 Fish 写个人数据失败；
6. Fish 尝试冒充 Cat 失败；
7. 两边读取同一共享药箱成功；
8. 两边状态镜像来自同一 Supabase；
9. Cat/Fish 原图分别只进入自己的 Originals 子目录；
10. Drive 原图 -> 600px WebP -> Supabase Storage -> 程序显示成功；
11. 两个 watch 都能几秒级唤醒对应 worker；
12. webhook 故障时一分钟 fallback 成功；
13. 只有 Cat backup leader 写 Daily/Monthly；
14. Daily backup 可用于恢复演练；
15. `vercel.json git.deploymentEnabled=false` 继续保持。

## 16. 部署纪律

任何 Vercel Preview / Production deployment 都必须先取得用户明确许可。

代码、文档、Google Drive 结构、CI、PR、merge 可以在部署前完成；Production migration、env 配置、Apps Script 正式 Web App 激活和 Vercel Production 发布统一放到获得许可后的激活阶段。
