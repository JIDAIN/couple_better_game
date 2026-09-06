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

```text
meals
meal_items
```

可选知识层：`foods / food_aliases`。

### 真实体重

```text
weight_measurements
```

与旧游戏 `daily_record_sides.weight_kg` 不是同一事实。

### 心情 / 睡眠 / 活动

```text
mood_entries
sleep_records
activity_entries
```

### 药箱 / 信箱 / 设置

各自保持独立 domain，不塞入一个通用 life 大表。

### Legacy Game

```text
daily_records
daily_record_sides
exchange_records
wallet_ledger
```

其中 deficit / 游戏运动 / 游戏体重快照继续属于旧游戏语义。

## 3. `meals`

当前核心字段：

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

### 热量语义

当前 Production 已允许 kcal 为 nullable：

```text
NULL = 未估算 / 不知道
0    = 确实为 0 kcal
```

禁止把 unknown 自动写成 0。

### 照片显示字段

R11.5 新增：

```text
photo_rotation_degrees smallint  0 / 90 / 180 / 270
photo_scale            numeric   0.60 .. 1.00
```

这两个字段是显示元数据，不表示图片像素已经被再次旋转或缩放编码。

当前正式 meal 仍只有一个 `photo_path`，即每顿只绑定 1 张正式展示图。

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

AI 记录时在能合理判断的情况下应尽量一次补全实际摄入量、重量和宏量营养，但数据库不会为了“完整”强制未知字段非空。

手动编辑已有 AI meal 时，必须 round-trip 保留已有 `food_id / display_name / estimated_weight_g / calorie range / macros`，除非用户实际修改相关食物或营养字段。

## 5. 单图持久化 vs 多图分析

聊天层可以同时分析餐前 / 餐后多张图片，但当前持久化模型为：

```text
meal -> one photo_path
```

所以：

- 多图可以共同参与“实际摄入”推断；
- 默认正式保存餐前图；
- 餐后图默认只作为差分依据；
- 用户指定保存餐后图时覆盖默认；
- 当前没有 `before_photo_path / after_photo_path`；
- 如果未来要永久保存多张图，应新增独立附件表，而不是继续向 `meals` 加第二、第三个 path 字段。

## 6. `mood_entries`

一天每个角色一条当前心情：

```text
id
couple_space_id
partner_key
mood_date
mood_key
source
created_at
updated_at
```

唯一键：

```text
couple_space_id + partner_key + mood_date
```

## 7. `sleep_records`

```text
id
couple_space_id
partner_key
sleep_date
fell_asleep_at
woke_at
source
created_at
updated_at
```

约束：`woke_at > fell_asleep_at`。

睡眠时长为派生值，不额外保存评分。

## 8. `activity_entries`

```text
id
couple_space_id
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

## 10. 外部写入与 Bridge ledger

跨域 AI / import 写入使用稳定幂等边界；Harbor Bridge 额外使用：

```text
life_drive_bridge_commands
```

按 `(actor, command_id)` 防止同一身份重复执行正式命令。

`record_write_receipts` 仍可用于部分外部写入回执语义。

这些表不是生活事实本身，而是写入控制事实。

## 11. 主要 Meal RPC

当前 Meal 相关 canonical RPC 包括：

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

R11.5 的照片函数只授权 service-role 路径。

## 12. Source / AI 写入

统一来源词汇：

```text
manual
chatgpt
import
```

AI 入口不获得任意 SQL。

通用 AI Access Core 负责：

```text
identity / permission
natural-language normalization
idempotency
media boundary
canonical domain dispatch
```

各 domain service 负责具体字段验证与业务规则。

饮食“先草稿、后确认”属于 AI 对话层规则，不对应数据库 draft 表，也不由数据层匹配确认关键词。

## 13. Fact vs Derived

事实：

- meal / meal item；
- weight measurement；
- mood / sleep / activity；
- medicine / mailbox 事实；
- daily record 原始游戏输入；
- exchange history；
- wallet ledger 事件；
- 外部写入控制记录。

派生 / 快照：

- wallet current balance；
- heatmap / week totals / streak；
- nutrition / weight daily summary；
- sleep duration；
- 月度心情展示；
- UI stale cache / STATE_* 镜像。

## 14. Migration 规则

- production schema / function / view / grant / RLS 变化必须新增 migration；
- 已执行 migration 不回改；
- migration 保存在 `supabase/migrations/`；
- migration 不等于真实数据备份。

R11.5 migration：

`supabase/migrations/20260906160000_add_meal_photo_display_transform.sql`

已在 Production Supabase 执行成功。
