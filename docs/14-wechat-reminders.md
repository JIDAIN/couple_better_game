# 提醒中心与微信提醒

状态：当前有效。  
状态日期：2026-09-07。

> 本文描述当前 Reminder Center V1、Supabase 调度与 PushPlus 微信投递的正式架构。历史 Google Drive / Apps Script Bridge 不再属于当前提醒链路。

## 1. 当前总链路

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
Supabase pg_cron（每 5 分钟）
        ↓
life_notification_deliveries
        ↓
Supabase Vault 中当前身份的 PushPlus token
        ↓
PushPlus
        ↓
对应微信
```

网站没有打开时，提醒仍会由云端执行。

提醒业务规则与 PushPlus 解耦：PushPlus 只是当前投递通道，Reminder Engine 不把业务规则硬编码成 PushPlus 专属逻辑。

## 2. 双身份边界

```text
cat  → 只读取 cat 的提醒实例 → 只使用 cat 的 PushPlus token
fish → 只读取 fish 的提醒实例 → 只使用 fish 的 PushPlus token
```

身份来自登录 / OAuth 上下文，不来自：

- AI 昵称；
- 用户自称；
- 前端提交的任意 actor；
- 普通聊天文本。

PushPlus token 加密保存在 Supabase Vault。网页与普通 API 只能读取 `已绑定 / 未绑定`，不会把 token 明文读回客户端。

## 3. V1 数据模型

### `life_reminder_rules`

表示持续规则或自定义提醒的来源，例如：

- 自定义提醒；
- 后续可扩展的模块规则。

主要职责：

```text
谁创建
发给谁：cat / fish / both
来源模块
标题 / 内容
计划时间
是否启用
```

### `life_reminder_instances`

表示一次真正会发生的提醒。

当前状态：

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

- `life_reminder_instances.status`：用户如何处理这条提醒；
- `life_notification_deliveries.status`：PushPlus 这次投递是否成功。

不要把“已发送”误认为“用户已完成”。

## 4. 当前 Reminder Center 来源

### 自定义提醒

网页可直接创建，例如：

```text
明天下午提醒我买猫砂
周五提醒我们交水费
```

接收范围：

```text
cat
fish
both
```

`both` 会物化为 Cat 与 Fish 各自的一条实例，因此双方后续可以独立完成、忽略或稍后提醒。

### 药箱到期提醒

每个账号有独立设置：

```text
medicine_reminder_enabled
medicine_offsets
```

默认：

```text
开启
提前 30 / 7 / 1 / 0 天
```

限制：

- 提前量 0～90 天；
- 每个账号最多 10 个提前量；
- 只物化未来约 90 天内的药箱实例，避免提醒中心一次塞入多年数据；
- 当前账号关闭药箱提醒后，只影响当前账号，不影响 Ta。

药品有效期采用当前药箱正式逻辑：包装有效期与开封后有效期同时存在时取更早者。

### 纪念日提醒

纪念日已经从旧的 PushPlus 直发逻辑迁入 Reminder Center，网页现在能看到未来纪念日实例。

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

每日未记录提醒仍保留为低噪音 system nudge，不进入长期 Reminder Center 列表。

原因：它是“当天是否需要提醒”的即时判断，不是一个值得提前物化和长期管理的生活事件。

默认：

```text
21:15
发送窗口约 20 分钟
```

当天本人已有心情、睡眠、餐食、体重，或本人参与/双方共同活动中的任一记录时，不再发送。

## 5. Reminder Center UI

入口：

```text
我的 → 提醒中心
```

首页同时提供轻量：

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

活动提醒支持：

```text
完成
1 小时后
忽略
```

药箱提醒额外支持：

```text
关闭药箱提醒
```

提醒设置当前保持轻量，只放：

- PushPlus 当前账号绑定状态；
- 药箱提醒开关；
- 药箱提前天数；
- 纪念日提醒当前状态摘要。

不加入项目、标签、优先级、子任务、看板等完整 TODO 产品概念。

## 6. Snooze 规则

`snooze` 不是只改网页显示时间。

当用户点击“1 小时后”：

```text
status → snoozed
snoozed_until → 新时间
notified_at → null
```

投递 dedupe 使用：

```text
instance id + effective due time
```

因此一条提醒即使已经成功推送过，也可以在用户明确点击“稍后提醒”后，于新时间合法再推送一次；同时不会因为网络重试重复轰炸。

## 7. PushPlus token 管理

服务端 RPC：

```text
get_life_pushplus_status(actor)
set_life_pushplus_token(actor, token)
clear_life_pushplus_token(actor)
test_life_pushplus(actor)
```

提醒设置还提供：

```text
get_life_reminder_settings(actor)
update_life_reminder_settings(actor, medicine_enabled, medicine_offsets)
```

任何 status / settings / test 响应都不得包含 token 明文。

## 8. 调度

### 提醒实例物化

Supabase cron：

```text
life-reminder-materialize-v1
每天执行
→ materialize_medicine_expiry_reminders
→ materialize_anniversary_reminders
```

### PushPlus 投递

Supabase cron：

```text
life-pushplus-reminders-v1
*/5 * * * *
```

每 5 分钟：

```text
1. 检查 Cat / Fish 是否绑定 PushPlus
2. 处理 daily-record system nudge
3. 查找到期的 Reminder Center instances
4. reserve delivery ledger
5. 调用 PushPlus
6. accepted / failed 回写 delivery ledger
7. 成功后写 instance.notified_at
```

## 9. 幂等与失败

`life_notification_deliveries` 负责：

- 防止同一次有效到期时间重复推送；
- PushPlus 成功记录 `accepted`；
- 失败记录 `failed`；
- 失败可按规则重试；
- 卡住的 `reserved` 可以超时恢复；
- PushPlus accepted 不等于用户已读或已完成。

## 10. 当前验收状态

```text
Reminder Engine / 数据模型              ✅
自定义提醒                              ✅
药箱自动提醒                            ✅
纪念日进入 Reminder Center              ✅ Supabase
完成 / 忽略 / snooze                    ✅
PushPlus 云端 5 分钟调度                 ✅
Cat PushPlus                             ✅ 已绑定
Cat 自动提醒实机链路                     ✅ 已验收
Fish PushPlus                            ✅ 已绑定
Fish 单独 PushPlus 测试                  ✅ 实机验收
both 双人 Reminder Engine 投递           ✅ Cat / Fish 各自独立实例与 token
Cat / Fish 双端微信实收                  ✅ 已验收
```

2026-09-07 最终双端验收：Fish 单独测试由 PushPlus 正常接受；`recipient_scope=both` 的系统验收提醒物化为 Cat / Fish 两条独立实例，两条 delivery 均为 `accepted`、失败数为 0，并分别使用各自 Vault token。Cat 与 Fish 随后均确认微信实际收到。测试提醒的 rule / instance 已清理，残留为 0。

2026-09-07 V1 UI closeout 代码已进入 GitHub `main`，包括首页最近 3 条、三分区完整提醒中心与轻量设置；按项目部署纪律，需要下一次明确 Production 授权后才会替换当前线上 UI。

## 11. 后续扩展原则

未来生理期、小信箱、睡眠、饮食、天气等提醒都应复用：

```text
业务模块
→ Reminder Engine
→ Reminder Instance
→ Notification delivery
```

不要为每个模块单独再做一套定时任务和 PushPlus 发送逻辑。
