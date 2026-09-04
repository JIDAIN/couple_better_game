# R10.1 Harbor AI Worker 一次性配对

## 目标

Harbor Worker 现在只负责 AI / Drive Bridge：

- ChatGPT 通过 Harbor Sheet 写入命令；
- Worker 使用固定 actor 的 HMAC 调用 Couple Better Game；
- 同步 `STATE_*`；
- 处理餐食原图 staging；
- 维护 Drive watch；
- Cat 负责单一家庭备份。

**微信提醒已从 Worker 移除**，由 Supabase -> PushPlus 独立完成。

## 为什么还需要这个桥

截至 2026-09-04，ChatGPT 个人 Plus 不能把自定义 MCP 作为完整可写 App 直接接入普通聊天；项目已经保留 Production `/mcp` 作为未来标准入口，但现阶段需要 Harbor Drive Bridge 承担“ChatGPT 对话 -> 生活数据写入”的兼容路径。

## 安全模型

```text
Harbor Bridge Sheet
  -> 一次性 pairing_code
  -> bound Apps Script Web App
  -> POST /api/drive-bridge/bootstrap
  -> 校验 bridge_id + sheet_id + code hash + expiry
  -> 返回长期 HMAC / watch / wake credentials
  -> 仅写入 Script Properties
  -> pairing_code 立即清空
  -> apps_script_url 自动回填 Supabase
  -> setupR10Triggers()
```

长期 secret 不进入聊天、Project Instructions、Google Sheet 或普通 Drive 文档。

### 固定身份

```text
Harbor Cat -> authoritative actor = cat -> AI 称呼 团子
Harbor Fish -> authoritative actor = fish -> AI 称呼 仔仔
```

昵称不会改变权限。Cat Worker 永远不能因为用户说“我是 fish”就切换成 fish，反之亦然。

## Apps Script 文件

R10.1 每个 Harbor Sheet 只需要：

```text
Code.gs
Pairing.gs
```

旧 `Reminder.gs` 已删除，不再需要配置 `PUSHPLUS_TOKEN`，也不再创建微信提醒 trigger。

### Cat

打开 `Couple Better Game AI Bridge - Cat`：

```text
扩展程序 -> Apps Script
```

### Fish

打开 `Couple Better Game AI Bridge - Fish`：

```text
扩展程序 -> Apps Script
```

脚本必须从对应 Sheet 打开，保持 bound script。`setupR10Pairing()` 会自动读取当前 Sheet ID。

## 唯一需要人工完成的激活步骤

当前可用连接器不能替用户创建 / 部署 Google Apps Script Web App，因此这里保留一次性人工操作。

每张 Harbor Sheet 分别执行一次：

1. `扩展程序 -> Apps Script`；
2. 将仓库中的 `Code.gs` 与 `Pairing.gs` 放入项目；
3. `Deploy -> New deployment -> Web app`；
4. `Execute as: Me`；
5. `Who has access: Anyone`；
6. 完成授权；
7. 运行 `setupR10Pairing()`。

成功后无需人工复制 Web App URL、HMAC secret 或其他长期密钥。

## `setupR10Pairing()` 自动完成

1. 读取当前 Sheet 的 `bridge_id` 与一次性 `pairing_code`；
2. 确认当前 Web App 已部署；
3. 调 Production `/api/drive-bridge/bootstrap`；
4. 服务端验证 actor + exact Sheet ID + code hash + expiry；
5. 长期 credential 写入 Script Properties；
6. Sheet pairing code 立即清空；
7. Production `apps_script_url` 自动回填；
8. 运行 `setupR10Triggers()`；
9. 建立每分钟命令处理 trigger；
10. 建立 Drive watch 续期；
11. Cat 建立单一家庭备份；
12. 刷新 `STATE_*` snapshot。

## Fast Wake：解决分钟级等待

实际 Cat 验收确认：`life_query` / `life_mutate` 到 Supabase 的正式执行通常约 1 秒，主要延迟发生在“ChatGPT 用 Google Sheets API 写入 COMMANDS”到“Apps Script 被唤醒”之间。

Google 官方限制说明：脚本执行和 API 请求不会触发 Apps Script 的 `onEdit` / installable edit trigger，因此不能依靠 Spreadsheet edit trigger 把 API 写入变成即时执行。

R10.2 增加 Project Fast Wake：

```text
ChatGPT Project
  -> 向 COMMANDS 追加 pending 行
  -> 立即 GET /api/drive-bridge/kick?bridgeId=...&commandId=...&token=...
  -> 服务端校验 bridge 固定身份 + 派生的 wake-only token
  -> 服务端使用未暴露的 apps_script_wake_secret POST Apps Script Web App
  -> processPendingCommands()
  -> life_query / life_mutate
  -> RECEIPTS
```

安全边界：

- Project 使用的 kick token 是由 Drive watch token 单向派生的 **wake-only capability**；
- Project Instructions 不保存 `bridge_secret`、`watch_token` 或 `apps_script_wake_secret`；
- Fast Wake 不能自行创建或修改生活数据，只能让已经配对的固定 actor Worker 立即处理 Sheet 中现有 pending COMMANDS；
- `commandId` 必须是 UUID；
- Drive push 和每 1 分钟 time trigger 继续保留，作为 Fast Wake 失败时的双重兜底。

目标体验从当前常见的几十秒到 2 分钟，降低为正常情况下十几秒级；真实值以 Production 验收为准。

## 一次性配对码生命周期

- 明文只临时出现在对应 Bridge Sheet `META`；
- 绑定 actor + exact Sheet ID；
- 默认 7 天过期；
- 成功一次后服务端删除 hash，Sheet 同时清空；
- 不能用于另一张 Sheet 或另一 actor；
- 如过期或重装，重新签发一次性 code，不复用长期 secret。

## AI 验收顺序

Cat 配对后先验证：

```text
读取今天记录 -> 写一条活动 -> 精确删除该活动 -> 上传一张餐食照片 -> 查询药箱
```

Fish 同样执行，并额外确认：

```text
Fish 只能修改 fish 的个人记录
Cat 只能修改 cat 的个人记录
双方可读取允许共享的数据
```

餐食照片必须验证：

```text
ChatGPT / Drive 原图
  -> actor 专属 Originals folder
  -> Worker staging
  -> 服务端自动裁剪/缩放
  -> 最长边 600px
  -> WebP quality 70
  -> >120KB 再逐步降质，最低 55
  -> 目标通常 50-100KB
  -> 绑定 meal photo
```

## 完成定义

- [x] Production bootstrap / HMAC / actor binding 后端存在；
- [x] Cat/Fish Bridge Sheets 已建立；
- [x] R10.1 已解除微信提醒依赖；
- [x] Worker 只需 Code.gs + Pairing.gs；
- [x] Cat Worker 一次性激活并配对成功；
- [x] Cat 完成真实查询、新增、精确删除闭环；
- [x] Cat 身份固定为 `cat`；
- [x] Fast Wake 代码与 wake-only token 安全模型已实现；
- [ ] Fast Wake CI 全绿并合并 main；
- [ ] 用户明确授权后部署 Fast Wake Vercel Production；
- [ ] Cat Production Fast Wake 延迟验收；
- [ ] Fish Worker 一次性激活并配对成功；
- [ ] Fish 完成真实读写、照片、药箱、身份隔离验收。