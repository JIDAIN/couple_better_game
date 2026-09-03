# R10 微信提醒与 Harbor AI 身份称呼

## 状态

本批是在 R10 双 Harbor Drive Bridge 上增加的低打扰微信提醒能力。

截至本文件落地时：

- R10 代码主线已经具备双 Harbor Bridge、HMAC、Drive 原图、临时 staging、单一家庭备份；
- Harbor Cat 固定身份为 `cat`，AI 会话称呼为 **团子**；
- Harbor Fish 固定身份为 `fish`，AI 会话称呼为 **仔仔**；
- `团子/仔仔` 只是会话层称呼，不能改变或替代服务端 `cat/fish` 权限绑定；
- 微信提醒代码可以合并并执行 Supabase migration，但只有 R10 Production 与两个 Apps Script Worker 实际部署后才会真正发送微信消息。

## 目标

提醒只解决两个场景：

1. 当天完全没有生活记录时，在晚上轻量提醒本人；
2. 根据 Couple Better Game 已保存的 `anniversaryDate` 提醒双方纪念日。

不做连续催促、排行榜、惩罚、比较或减脂竞争提醒。

## 通知架构

```text
Harbor Cat Apps Script                 Harbor Fish Apps Script
        |                                      |
        | HMAC 固定 cat                        | HMAC 固定 fish
        v                                      v
POST /api/drive-bridge/reminders       POST /api/drive-bridge/reminders
        |                                      |
        +------------------+-------------------+
                           v
                 Supabase reminder claim
                 + 幂等 delivery ledger
                           |
                  返回本人待发 reminder
                           |
                           v
                  Apps Script -> PushPlus
                           |
                           v
                       微信渠道
                           |
                           v
                  complete accepted/failed
```

PushPlus token **不进入 Vercel、Supabase、Google Sheet、Project Instructions 或 AI Core**，只保存在各自 Apps Script 的 Script Properties。

## 默认提醒规则

### 每日记录提醒

- 默认开启；
- 时区：`Asia/Shanghai`；
- 默认时间：**21:15**；
- Apps Script 每 5 分钟检查一次；
- 后端只在默认时间后的 20 分钟窗口内允许 claim；
- 当天只要本人已经有以下任一记录，就不发送：
  - 心情；
  - 睡眠；
  - 餐食；
  - 体重；
  - 本人参与或双方共同的活动。

文案原则：

> 今天还没有看到你的生活记录。记一点就好，不用补全，也不用和 Ta 比较。

Cat 消息署名为 **团子**；Fish 消息署名为 **仔仔**。

### 纪念日提醒

- 默认开启；
- 使用 `app_configs.anniversary_date`，不另建重复纪念日数据源；
- 默认时间：**09:15**；
- 默认提前量：**7 天、1 天、当天**；
- 2 月 29 日纪念日在非闰年按 2 月 28 日提醒。

## 幂等与失败处理

`life_notification_deliveries` 为每次通知生成唯一 `dedupe_key`：

- 已被 PushPlus 接受的同一通知不重复发送；
- PushPlus 发送失败可在 5 分钟后重试；
- 最多 3 次；
- worker claim 后若进程中断，15 分钟后允许重新 claim；
- PushPlus 返回成功只表示平台接受请求，因此数据库状态命名为 `accepted`，不伪装成“微信已送达”。

Apps Script 还会在 PushPlus 已接受、但回写 Couple Better Game 失败时，临时保存 `WECHAT_ACCEPTED_<deliveryId>`。下一轮只补 complete，不重复向微信再发一条。

## 数据表

### `life_notification_preferences`

每个 actor 一行：

- `enabled`
- `timezone`
- `daily_record_reminder_enabled`
- `daily_record_reminder_time`
- `anniversary_reminder_enabled`
- `anniversary_reminder_time`
- `anniversary_offsets`

默认 Cat/Fish 都启用。后续可以再把这些字段暴露到设置页或 Harbor AI 的 `settings` 写入接口，不需要重构通知底层。

### `life_notification_deliveries`

记录：

- actor；
- 类型；
- 日期；
- dedupe key；
- attempt count；
- `reserved / accepted / failed`；
- provider message id/error。

只允许服务端访问。

## Apps Script 一次性配置

两个 Worker 都在原 R10 Script Properties 基础上新增：

```text
PUSHPLUS_TOKEN=<本人 PushPlus 消息 token>
```

然后使用新的统一入口：

```text
setupR10All()
```

它会同时安装：

- COMMANDS 每分钟处理；
- Drive watch 续期；
- Cat 单一家庭备份；
- 微信提醒每 5 分钟检查。

没有配置 `PUSHPLUS_TOKEN` 时，微信 worker 会安全跳过，不影响 R10 Bridge 其他功能。

## 身份安全

### Harbor Cat / 团子

```text
Project = Harbor Cat
AI = 团子
authoritative actor = cat
Ta = fish
Bridge = Couple Better Game AI Bridge - Cat
```

### Harbor Fish / 仔仔

```text
Project = Harbor Fish
AI = 仔仔
authoritative actor = fish
Ta = cat
Bridge = Couple Better Game AI Bridge - Fish
```

任何聊天指令、Sheet COMMANDS 内容、AI 昵称都不能把 Cat Worker 切成 fish，反之亦然。后端始终以通过 HMAC 校验得到的 Bridge actor 为准。

## 完成定义

本功能只有满足以下条件才算生产完成：

1. 代码 CI 全绿并合并 main；
2. notification migration 已执行 Production；
3. R10 main 已获得用户明确授权并部署到 Vercel Production；
4. Cat/Fish 两个 Apps Script Web App 均已部署并执行 `setupR10All()`；
5. 两个 Apps Script URL 已回填 `life_drive_bridge_configs`；
6. Cat/Fish 各完成一次真实微信测试；
7. 验证已有当天记录时不会再发 daily reminder；
8. 验证 delivery ledger 不会重复发同一提醒。
