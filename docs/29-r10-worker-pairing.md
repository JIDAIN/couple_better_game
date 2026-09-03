# R10 Harbor Worker 一次性配对

## 目标

将原先需要人工复制的长期 HMAC / watch / wake secret 改为一次性配对流程。

原则：

```text
Harbor Bridge Sheet
  -> 一次性 pairing_code（短期、只用一次）
  -> bound Apps Script Web App
  -> POST /api/drive-bridge/bootstrap
  -> 服务端校验 bridge_id + sheet_id + code hash + expiry
  -> 返回长期 worker credentials
  -> Script Properties
  -> pairing_code 立即清空
  -> Apps Script URL 自动回填 Supabase
  -> setupR10All()
```

长期 secret 不进入聊天、Project Instructions、Google Sheet 或普通 Drive 文档。

## 后端

新增：

```text
POST /api/drive-bridge/bootstrap
```

请求：

```json
{
  "bridgeId": "cat|fish",
  "pairingCode": "one-time code",
  "sheetId": "bound bridge sheet id",
  "webAppUrl": "https://script.google.com/macros/s/.../exec"
}
```

服务端只接受：

- `bridge_id` 与 actor 一致；
- `sheet_id` 与 Production 预登记 Sheet 完全一致；
- pairing code SHA-256 与 Production hash 一致；
- code 未过期；
- code 尚未使用；
- Web App URL 必须是正式 `script.google.com/macros/s/.../exec` URL。

成功后原子地：

- 写入 `apps_script_url`；
- 写 `paired_at`；
- 清空 pairing hash / expiry；
- 返回长期 bridge/watch/wake credentials 与 actor Originals folder；
- Worker 保存到 Script Properties。

## Apps Script 文件

每个 Harbor Sheet 使用同一套三个文件：

```text
Code.gs
Reminder.gs
Pairing.gs
```

不需要手工编辑 actor-specific secret。

### Cat

从 `Couple Better Game AI Bridge - Cat` 打开：

```text
扩展程序 -> Apps Script
```

### Fish

从 `Couple Better Game AI Bridge - Fish` 打开：

```text
扩展程序 -> Apps Script
```

这样脚本是 **bound script**，`setupR10Pairing()` 会自动读取当前 Sheet ID。

## Web App 部署

在 Apps Script 中：

```text
Deploy -> New deployment -> Web app
Execute as: Me
Who has access: Anyone
```

需要 `Anyone` 是因为 Google Drive push 到 Vercel 后，Vercel 会通过带随机 `WAKE_SECRET` 的 POST 唤醒 Worker；Web App 本身仍会检查 secret + bridgeId，不接受普通匿名命令。

部署完成后不要人工复制 URL 到 Supabase。运行：

```text
setupR10Pairing()
```

它会自动：

1. 读取当前 Sheet 的 `bridge_id` 与 `pairing_code`；
2. 获取当前 Web App URL；
3. 完成一次性配对；
4. 将长期 credential 保存到 Script Properties；
5. 清空 Sheet pairing code；
6. 自动回填 Production `apps_script_url`；
7. 执行 `setupR10All()`；
8. 建立每分钟命令兜底、Drive watch 续期、Cat 单家庭备份、微信提醒 trigger；
9. 刷新 `STATE_*`。

## PushPlus

长期微信 token 不参与 bootstrap，也不会进入 Sheet。

两边分别在：

```text
Apps Script -> Project Settings -> Script Properties
```

新增：

```text
PUSHPLUS_TOKEN = 本人 PushPlus token
```

然后重新运行：

```text
setupWechatReminderTrigger()
```

Cat token 对应 cat 微信；Fish token 对应 fish 微信。

## 一次性配对码生命周期

- 由 Production 后端预登记 SHA-256；
- 明文只临时出现在对应 Bridge Sheet `META`；
- 绑定 actor + exact Sheet ID；
- 默认 7 天过期；
- 成功一次后服务端删除 hash，Sheet 同时清空明文；
- 不能用于另一张 Sheet 或另一 actor；
- 以后如需重装 Worker，重新发一个新 pairing code，不复用旧 secret 传递流程。

## 完成定义

Pairing patch 完成不等于 R10 最终验收。最终还必须：

1. Pairing patch CI 全绿并合并 main；
2. Pairing migration Production 完成；
3. 用户再次明确允许 Vercel Production 部署 pairing patch；
4. Cat bound Worker 配对成功；
5. Fish bound Worker 配对成功；
6. Supabase 两条 `apps_script_url` 均非空；
7. 两边 snapshot / command / identity isolation 验收；
8. 原图压缩链路验收；
9. Cat 单备份 leader 验收；
10. Cat/Fish PushPlus 分别真实发送验收。
