# 提醒中心与微信提醒

状态：当前有效。  
状态日期：2026-09-07。

> 本文描述当前 Reminder Center V1、Supabase 调度与 PushPlus 微信投递的正式架构。历史 Google Drive / Apps Script Bridge 不再属于当前提醒链路。

## 1. 正式链路

```text
生活模块 / 自定义提醒
        ↓
Reminder Engine
        ↓
life_reminder_rules
life_reminder_instances
        ↓
网页提醒中心
        +
Supabase pg_cron
        ↓
life_notification_deliveries
        ↓
Supabase Vault 中当前身份的 PushPlus token
        ↓
PushPlus
        ↓
对应微信
```

网站没有打开时提醒仍由云端执行。

Reminder Engine 与 PushPlus 解耦：PushPlus 只是当前投递通道，业务规则不硬编码在 PushPlus 里。

## 2. 双身份边界

```text
cat  → 只处理 cat 的实例 → 只使用 cat 的 PushPlus token
fish → 只处理 fish 的实例 → 只使用 fish 的 PushPlus token
```

身份来自登录 / OAuth / 服务端签名上下文，不来自：

- AI 昵称；
- 用户自称；
- 前端提交的任意 actor；
- 普通聊天文本。

PushPlus token 加密保存在 Supabase Vault。网页与普通 API 只能读取 `已绑定 / 未绑定` 状态，不能把 token 明文读回客户端。

## 3. 数据模型

### `life_reminder_rules`

表示持续规则或自定义提醒来源，记录：

```text
创建者
recipient_scope = cat | fish | both
source_kind
标题 / 内容
计划时间
是否启用
```

### `life_reminder_instances`

表示一次真正会发生的提醒。

状态：

```text
pending
snoozed
completed
dismissed
```

主要字段：

```text
recipient
source_kind
source_ref
due_at
snoozed_until
notified_at
status
dedupe_key
metadata
```

用户状态与投递状态分离：

- `life_reminder_instances.status`：用户如何处理提醒；
- `life_notification_deliveries.status`：这一次 PushPlus 投递结果。

PushPlus `accepted` 不等于用户已完成。

## 4. 当前来源

### 自定义提醒

接收范围：

```text
cat
fish
both
```

`both` 会物化为 Cat 与 Fish 各自一条实例，因此双方可以独立完成、忽略或 snooze。

### 药箱到期提醒

每个账号独立设置：

```text
medicine_reminder_enabled
medicine_offsets
```

默认：

```text
开启
提前 30 / 7 / 1 / 0 天
```

规则：

- 提前量范围 0～90 天；
- 每个账号最多 10 个提前量；
- 只物化未来约 90 天实例；
- 关闭只影响当前账号；
- 包装有效期与开封后有效期同时存在时，按更早者提醒。

### 纪念日提醒

纪念日已经进入 Reminder Center，不再走独立的旧直发分支。

来源：

```text
app_configs.anniversary_date
```

默认：

```text
09:15
提前 7 天 / 1 天 / 当天
```

2 月 29 日在非闰年按 2 月 28 日处理。

### 每日未记录提醒

每日未记录提醒保留为低噪音 system nudge，不进入长期 Reminder Center 列表。

默认：

```text
21:15
发送窗口约 20 分钟
```

当天本人已有心情、睡眠、餐食、体重，或本人参与 / 双方共同活动中的任一记录时，不再发送。

## 5. Reminder Center UI

入口：

```text
我的 → 提醒中心
```

首页：

```text
接下来
→ 最近 3 条提醒
→ 点击进入完整提醒中心
```

提醒中心分区：

```text
今天
即将到来
已完成
提醒设置
```

提醒操作：

```text
完成
1 小时后
忽略
```

提醒设置保持轻量：

- 当前 PushPlus 绑定状态；
- 药箱提醒开关；
- 药箱提前天数；
- 纪念日提醒摘要。

不扩张为项目、标签、优先级、子任务、看板等完整 TODO 产品。

## 6. Snooze

点击“1 小时后”时：

```text
status → snoozed
snoozed_until → 新时间
notified_at → null
```

投递 dedupe 使用：

```text
instance id + effective due time
```

因此一条已经成功推送的提醒，也可以在用户明确 snooze 后于新时间再次推送；网络重试仍不会造成同一有效到期时间重复轰炸。

## 7. 调度

实例物化：

```text
life-reminder-materialize-v1
每天执行
→ materialize_medicine_expiry_reminders
→ materialize_anniversary_reminders
```

PushPlus 投递：

```text
life-pushplus-reminders-v1
*/5 * * * *
```

每 5 分钟：

```text
1. 检查当前 actor 是否配置 PushPlus
2. 处理 daily-record system nudge
3. 找到期 Reminder Center instances
4. reserve delivery ledger
5. 调用 PushPlus
6. accepted / failed 回写 delivery ledger
7. 成功后写 instance.notified_at
```

## 8. 幂等与失败

`life_notification_deliveries` 负责：

- 防止同一次有效到期时间重复推送；
- 成功记录 `accepted`；
- 失败记录 `failed`；
- 允许按规则重试；
- 卡住的 `reserved` 可以超时恢复。

## 9. 当前验收状态

```text
Reminder Engine / 数据模型               ✅ Production
自定义提醒                               ✅ Production
药箱自动提醒                             ✅ Production
纪念日进入 Reminder Center               ✅ Production
完成 / 忽略 / snooze                     ✅ Production
首页最近 3 条                            ✅ Production
今天 / 即将到来 / 已完成                 ✅ Production
提醒设置                                 ✅ Production
PushPlus 云端 5 分钟调度                  ✅
Cat PushPlus                             ✅
Fish PushPlus                            ✅
Cat 自动提醒实机链路                     ✅
Fish 单独 PushPlus 实机测试               ✅
both 双人实例与独立 token                ✅
Cat / Fish 双端微信实收                  ✅
```

2026-09-07 双端验收：`recipient_scope=both` 会物化为 Cat / Fish 两条独立实例，两条 delivery 分别使用各自 Vault token；验收时均为 `accepted`、失败数为 0，双方均确认微信实际收到。测试 rule / instance 已清理，残留为 0。

Reminder Center V1 UI closeout 已随 Production deployment `dpl_GC1Ut3u64w5rpZ8iwzRp5nyyvWmm` 正式上线；`/me/reminders` 发布后 HTTP 200，最近 30 分钟未发现 runtime error。

## 10. 后续扩展原则

未来生理期、小信箱、睡眠、饮食、天气等提醒都应复用：

```text
业务模块
→ Reminder Engine
→ Reminder Instance
→ Notification delivery
```

不要为每个模块单独再做一套定时任务和 PushPlus 发送逻辑。
