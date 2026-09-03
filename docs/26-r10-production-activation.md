# R10 Production 激活与简化方案

**状态日期：2026-09-03**

本文记录 PR #44 后的 R10 最终 Production 形态。`docs/25-r10-chatgpt-project-drive-bridge.md` 保留前期完整设计历史；若两者冲突，以本文的 Production 实现为准。

## 1. 最终入口

```text
Harbor Cat  -> Couple Better Game AI Bridge - Cat  -> actor=cat
Harbor Fish -> Couple Better Game AI Bridge - Fish -> actor=fish
```

两个 Project 访问同一个 Couple Better Game、同一个 Supabase 与同一套家庭备份；只区分 AI 入口、命令总线和个人原图目录。

当前不设置额外 AI 人格，两个 Project 均使用 ChatGPT 默认人格。Drive 中分别保存 `Harbor Cat AI Core` / `Harbor Fish AI Core`，只规定身份和数据访问规则。

## 2. Supabase 仍是唯一事实源

- `STATE_*`：Google Sheets 中的只读镜像，可重建；
- `COMMANDS`：ChatGPT 追加命令；
- `RECEIPTS`：真实执行回执；
- 所有真实写入最终经过 `life_query / life_mutate` 与 canonical service；
- `life_drive_bridge_commands` 以 `(actor, command_id)` 做持久幂等；
- Google Drive 不取代数据库。

## 3. Production 配置不再依赖新增 Vercel env

PR #44 新增 server-only `life_drive_bridge_configs`：

```text
bridge_id
actor
bridge_secret
watch_token
apps_script_url
apps_script_wake_secret
originals_meals_folder_id
backup_leader
active
```

表开启 RLS，`anon/authenticated` 无权限，只允许 `service_role` 访问。Vercel 继续使用已经存在的 `SUPABASE_SECRET_KEY` 读取运行配置。

好处：

- 不需要在 Vercel 手工维护一组 R10 secret；
- Cat/Fish 仍有独立 HMAC / watch / wake credential；
- secret 不进入 GitHub、Google Sheet、Project Instructions 或模型上下文。

## 4. 原图链路取消 Google Service Account

早期方案需要 Vercel Service Account 直接下载 Google Drive 原图。Production 最终方案取消该依赖。

最终链路：

```text
ChatGPT Project 上传原图
-> Google Drive Originals/Meals/Cat|Fish 永久原图
-> COMMANDS 引用 Drive fileId
-> Apps Script 使用当前 Google 账号读取并校验原图
-> Vercel /api/drive-bridge/stage 生成一次性 Supabase signed upload URL
-> Apps Script 将原图直接 PUT 到私有 drive-bridge-staging
-> Vercel 从 staging 下载
-> rotate + 最长边 600px + WebP q70
-> >120KB 时 q65 -> q60 -> q55
-> 写入 meal-photos
-> 删除 drive-bridge-staging 临时原图
```

因此：

- Google Drive 原图不压缩、不重编码，是永久母版；
- staging 只是短暂跨服务运输，不是备份；
- Supabase Storage `meal-photos` 只保存程序显示版；
- 普通网页上传仍为 10MB；Drive 原图通道允许到 25MB。

## 5. 临时 staging 安全边界

私有 bucket：`drive-bridge-staging`。

- `public=false`；
- 25MB 上限；
- 仅允许 jpeg/png/webp/heic/heif；
- staging path 固定为 `<actor>/<command_id>/original`；
- 服务端重新校验 path、MIME 和文件大小；
- Vercel 使用后在 `finally` 中删除临时对象；
- permanent original 仍只保留在 Drive。

## 6. Apps Script

Cat 与 Fish 各自使用一份相同代码的独立 Apps Script Project。

每份 Script Properties：

```text
BRIDGE_ID
SHEET_ID
BRIDGE_SECRET
WATCH_TOKEN
WAKE_SECRET
ORIGINALS_MEALS_FOLDER_ID
BACKUP_LEADER
```

Cat：`BACKUP_LEADER=true`；Fish：`false`。只有 Cat 每天写一次完整家庭备份，避免同一天重复两份。

触发器：

- `processPendingCommands`：每 1 分钟兜底；
- `renewDriveWatch`：每 6 小时维护 Drive push channel；
- `createDailyBackup`：Cat 每日运行；
- Drive push 正常时目标体验为秒级；Google 不承诺严格实时 SLA，push 丢失时退化到约 1 分钟兜底。

## 7. 备份

唯一家庭灾备：

```text
Backups/Daily/YYYY-MM-DD.json
Backups/Monthly/YYYY-MM.json
```

包含 `get_life_full_export + settings + legacy_home`。原始餐食照片永久保存在 Google Drive Originals。Supabase 压缩图可由 Drive 原图重建；旧历史只有压缩图的照片后续归档 `Backups/Legacy-Photos`。

## 8. 双 Project 隔离边界

服务器端真正的安全边界是：

- Cat worker secret 只能映射 cat；
- Fish worker secret 只能映射 fish；
- personal write 继续由 life registry 做 owner 校验；
- Sheet 中自行伪造 `actor` 不被信任。

但如果 Harbor Cat 与 Harbor Fish 同处于同一个 ChatGPT 账号并共享同一个 Google Drive 连接，Google Drive 本身不能密码学证明“哪一个 ChatGPT Project 发起了某次 Sheet 编辑”。因此 Project Instructions 必须固定只访问自己对应的 Bridge Sheet。若未来需要真正账户级隔离，Fish 可改用自己的 ChatGPT/Google 账号，底层数据库架构无需变化。

## 9. Production 激活顺序

1. `r10_drive_bridge_ledger` migration；
2. `r10_bridge_runtime_config` migration；
3. 写入 Cat/Fish server-only runtime config；
4. 合并 PR #44；
5. 手动 Production deployment，Git 自动部署继续关闭；
6. 分别创建/部署 Cat/Fish Apps Script Web App；
7. 回填两个 `apps_script_url`；
8. 执行两边 `setupR10Triggers()`；
9. 验证 Cat/Fish snapshot、写入、权限、幂等、照片、备份、push 与 fallback；
10. 将各自 AI Core + Shared Skills 加入对应 ChatGPT Project，并进行新聊天窗口验收。

## 10. 部署纪律

`vercel.json` 必须继续保持：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

本次 R10 Production 激活已经获得用户明确授权，但该授权不等于重新开启 Git 自动部署。
