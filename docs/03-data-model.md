# 数据模型与 Source of Truth

状态：2026-09-07。

## 1. 核心原则

```text
事实数据优先保存
派生数据允许缓存，但必须可从事实重算
不同业务域不互相覆盖
UI 可以很轻，数据结构不能贫瘠
```

Supabase 是正式数据 Source of Truth，但同一个 Supabase project 内存在多个明确隔离的业务域，不能因为物理上共库就把它们当成同一套数据。

当前产品关系：

```text
Couple Better Game（当前主程序 / Island Life）
└─ 游戏
   └─ 变瘦变美大作战（Legacy Game 子项目）
```

旧版“变瘦变美大作战”现已成为新程序「游戏」中的独立子项目。它保留自己的历史和规则，但不属于当前生活记录字段。

## 2. 三个数据域

### Island Life：当前主程序生活事实

```text
meals
meal_items
mood_entries
sleep_records
activity_entries
weight_measurements
medicine_items
mailbox_letters
```

### Legacy Game：旧版游戏子项目

```text
daily_records
daily_record_sides
exchange_categories
exchange_records
wallets
wallet_ledger
```

金币、宝石、钱包、兑换记录、旧版每日打卡全部属于 Legacy Game，不属于 Island Life。

### Shared / System：共享基础设施

```text
couple_spaces
partner_profiles
app_configs
record_write_receipts
life_fixed_accounts
life_backup_snapshots
life_mcp_code_redemptions
life_notification_preferences
life_notification_deliveries
```

这些属于身份、配置、备份、通知或系统控制层，不能简单当成生活事实或游戏事实。

完整维护规则见 [`48-life-legacy-game-data-boundary.md`](48-life-legacy-game-data-boundary.md)。

## 3. 数据隔离硬规则

```text
Island Life maintenance ≠ Legacy Game maintenance
```

任何“生活数据清理 / 测试数据清理 / Life import / Life restore”默认只能操作 Island Life allowlist。

除非用户明确要求操作旧游戏，否则不能触碰：

```text
daily_records
daily_record_sides
exchange_categories
exchange_records
wallets
wallet_ledger
```

禁止仅凭 `created_at`、业务日期或“本周”这种跨域条件直接扫所有表。

代码层表级边界定义在 `lib/server/life-data-domains.ts`。

## 4. `meals`

核心字段：

```text
id
couple_space_id
partner_key
meal_date
meal_type
eaten_at
snack_period
status
source
total_calories_kcal nullable
calorie_min_kcal nullable
calorie_max_kcal nullable
note
idempotency_key nullable
photo_path nullable
photo_rotation_degrees
photo_scale
created_at
updated_at
deleted_at
```

`NULL` kcal 表示未知，`0` 表示确实为 0 kcal。

当前正式 meal 只有一个 `photo_path`；`photo_rotation_degrees` 与 `photo_scale` 是显示元数据。

## 5. `meal_items`

```text
id
meal_id
food_id nullable
raw_name
display_name
portion_description nullable
estimated_weight_g nullable
calories_kcal nullable
calorie_min_kcal nullable
calorie_max_kcal nullable
protein_g nullable
carbs_g nullable
fat_g nullable
sort_order
created_at
updated_at
```

AI 记录时应尽量补全实际摄入量、重量和宏量营养，但数据库不会为了“完整”强制未知字段非空。

正式 meal 默认应保存可识别的食物详细 items，并同时保存整餐汇总；总热量不能代替详细项。

## 6. 单图持久化 vs 多图分析

聊天层可以同时分析餐前 / 餐后多图，但当前持久化模型为：

```text
meal -> one photo_path
```

多图可共同参与推断；默认保存餐前图；当前没有 `before_photo_path / after_photo_path`。

## 7. `mood_entries`

一天每个角色一条当前心情。唯一键：

```text
couple_space_id + partner_key + mood_date
```

## 8. `sleep_records`

```text
partner_key
sleep_date
fell_asleep_at
woke_at
source
created_at
updated_at
```

约束：`woke_at > fell_asleep_at`。

## 9. `activity_entries`

```text
activity_date
occurred_at nullable
text
participant_scope
activity_type nullable
duration_minutes nullable
source
created_at
updated_at
deleted_at
```

活动是一对多事件流，删除使用 soft delete。

## 10. `weight_measurements`

```text
partner_key
measured_at nullable
measurement_date
weight_kg
source
context
note
linked_daily_record_side_id nullable
idempotency_key nullable
```

AI 记体重写这里，不自动覆盖旧游戏体重快照。

## 11. 外部写入与幂等

跨域 AI / import 写入使用稳定幂等边界。`record_write_receipts` 可用于部分外部写入回执语义。

这些控制记录不是生活事实本身。

## 12. 主要 Meal RPC

```text
list_meals
create_meal_record
update_meal_record
delete_meal_record
create_chatgpt_meal_record
get_chatgpt_meal_record
replace_meal_photo_state
update_meal_photo_display
```

## 13. Source / AI 写入

统一来源词汇：

```text
manual
chatgpt
import
```

AI 入口不获得任意 SQL。AI Access Core 负责 identity / permission / normalization / idempotency / media boundary / canonical dispatch。

饮食“先草稿、后确认”属于 AI 对话层规则，不对应数据库 draft 表。

`legacy_home` 是旧版游戏兼容入口，不属于普通 Island Life resource。

## 14. Fact vs Derived

Island Life 事实包括 meal、weight、mood、sleep、activity、medicine、mailbox。

Legacy Game 事实包括 daily record、exchange、wallet ledger；它们只在游戏子项目内解释。

派生 / 快照包括 wallet current balance、heatmap、nutrition summary、sleep duration、月度心情展示与 UI stale cache。

## 15. Migration 规则

- Production schema / function / view / grant / RLS 变化必须新增 migration；
- 已执行 migration 不回改；
- migration 保存在 `supabase/migrations/`；
- migration 不等于真实数据备份；
- 当前只做逻辑硬隔离，不迁移 Legacy Game 到独立 PostgreSQL schema；如未来需要物理迁移，必须单独设计 migration 和回归测试。
