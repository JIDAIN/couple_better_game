# 数据模型与 Source of Truth

状态：2026-09-06。

## 1. 核心原则

```text
事实数据优先保存
派生数据允许缓存，但必须可从事实重算
不同业务域不互相覆盖
UI 可以很轻，数据结构不能贫瘠
```

Supabase 是正式生活数据 Source of Truth。Legacy Game 和 V2 Life 可以按日期一起展示，但不能混成同一个事实字段。

## 2. 主要事实域

### 饮食摄入
`meals` / `meal_items`

### 真实体重
`weight_measurements`

### 心情 / 睡眠 / 活动
`mood_entries` / `sleep_records` / `activity_entries`

### 药箱 / 信箱 / 设置
各自保持独立 domain。

### Legacy Game
`daily_records` / `daily_record_sides` / `exchange_records` / `wallet_ledger`

## 3. `meals`

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

## 4. `meal_items`

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

## 5. 单图持久化 vs 多图分析

聊天层可以同时分析餐前 / 餐后多图，但当前持久化模型为：

```text
meal -> one photo_path
```

多图可共同参与推断；默认保存餐前图；当前没有 `before_photo_path / after_photo_path`。

## 6. `mood_entries`

一天每个角色一条当前心情。唯一键：

```text
couple_space_id + partner_key + mood_date
```

## 7. `sleep_records`

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

## 8. `activity_entries`

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

## 9. `weight_measurements`

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

## 10. 外部写入与幂等

跨域 AI / import 写入使用稳定幂等边界。`record_write_receipts` 可用于部分外部写入回执语义。

这些控制记录不是生活事实本身。

## 11. 主要 Meal RPC

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

## 12. Source / AI 写入

统一来源词汇：

```text
manual
chatgpt
import
```

AI 入口不获得任意 SQL。AI Access Core 负责 identity / permission / normalization / idempotency / media boundary / canonical dispatch。

饮食“先草稿、后确认”属于 AI 对话层规则，不对应数据库 draft 表。

## 13. Fact vs Derived

事实包括 meal、weight、mood、sleep、activity、medicine、mailbox、daily record、exchange、wallet ledger 与外部写入控制记录。

派生 / 快照包括 wallet current balance、heatmap、nutrition summary、sleep duration、月度心情展示与 UI stale cache。

## 14. Migration 规则

- Production schema / function / view / grant / RLS 变化必须新增 migration；
- 已执行 migration 不回改；
- migration 保存在 `supabase/migrations/`；
- migration 不等于真实数据备份。
