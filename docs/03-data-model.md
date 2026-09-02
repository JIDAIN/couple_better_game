# 数据模型与 Source of Truth

## 1. 核心原则

```text
事实数据优先保存
派生数据允许缓存，但必须可从事实重算
不同业务域不互相覆盖
UI 可以很轻，数据结构不能贫瘠
```

当前项目同时存在 legacy game 和新 V2 life system。二者可以按日期展示在一起，但不混成同一个事实字段。

## 2. 领域划分

### 2.1 饮食摄入

真相源：

```text
meals
meal_items
```

可选知识层：`foods / food_aliases`。

### 2.2 Legacy Game

真相源：

```text
daily_records
daily_record_sides
exchange_records
wallet_ledger
```

`daily_record_sides.deficit_kcal / exercise_minutes / weight_kg` 仍属于旧游戏语义。

### 2.3 真实体重

真相源：

```text
weight_measurements
```

它与旧游戏 `daily_record_sides.weight_kg` 不是同一个事实。

### 2.4 V2 Life

V2-P1 新事实域：

```text
mood_entries
sleep_records
activity_entries
```

首页未来只消费这三个轻量领域。

### 2.5 Future Medicine

家庭药箱将是独立 domain，不塞进 life entry 大表。最终 schema 等真实 Excel 字段确认后建立。

## 3. `mood_entries`

一天每个角色一条当前心情：

```text
id
couple_space_id
partner_key       fish / cat
mood_date
mood_key          happy / calm / neutral / anxious / sad / angry / tired
source            manual / chatgpt / import
created_at
updated_at
```

唯一键：

```text
couple_space_id + partner_key + mood_date
```

不保存 `mood_score`。心情 key 是分类事实，不存在“开心分数更高”。

这个结构可以直接支持后续小窝中的月度双人心情日历。

## 4. `sleep_records`

一天每个角色一条简单睡眠记录：

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

睡眠时长是派生值：

```text
woke_at - fell_asleep_at
```

数据库不保存“睡眠评分 / 达标 / 早睡成功”。

## 5. `activity_entries`

活动是一对多事件流：

```text
id
couple_space_id
activity_date
occurred_at nullable
text
participant_scope   both / fish / cat
activity_type nullable
duration_minutes nullable
source
created_at
updated_at
deleted_at
```

产品首版只要求用户写一句 `text`；`participant_scope` 默认 `both`。

`activity_type / duration_minutes / occurred_at` 是可选结构化字段，未来 AI 在事实明确时可以补充，但 UI 不强迫用户选择“学习 / 运动 / 散步”等分类。

删除活动使用 soft delete。

## 6. `record_write_receipts`

V2-P1 新增跨领域外部写入回执：

```text
id
couple_space_id
source            chatgpt / import
domain            meal / mood / sleep / activity / weight / medicine
idempotency_key
entity_id
created_at
```

唯一键：

```text
couple_space_id + idempotency_key
```

它不是生活事实，而是写入控制事实，解决两个问题：

1. ChatGPT / import 重试需要稳定幂等；
2. 实体后来被手动编辑后，不能因为实体自身 idempotency 字段被覆盖而忘记“某次外部写入已经执行过”。

当前 meal 已经有自己的 `meals.idempotency_key`，暂时不强行迁移。未来新的 AI domain 优先复用 receipt 模式。

`entity_id` 不设跨表 FK，因为它可能指向不同 domain 的实体；domain-specific service 负责解释。

## 7. 营养表

### `meals`

```text
partner_key
meal_date
meal_type
eaten_at
snack_period
status
source
total_calories_kcal
calorie_min_kcal
calorie_max_kcal
note
idempotency_key
deleted_at
```

### `meal_items`

```text
meal_id
food_id nullable
raw_name
display_name
portion_description
estimated_weight_g
calories_kcal
calorie_min_kcal
calorie_max_kcal
protein_g
carbs_g
fat_g
sort_order
```

当前 production kcal 仍为必填。后续单独 migration 改为 nullable，必须保持：

```text
NULL = 未估算
0 = 确实为 0 kcal
```

## 8. 体重表

### `weight_measurements`

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

未来 AI 记体重必须写这里，不自动覆盖旧游戏体重快照。

## 9. 游戏核心表

继续保留：

```text
couple_spaces
partner_profiles
app_configs
daily_records
daily_record_sides
exchange_categories
exchange_records
wallets
wallet_ledger
```

兑换机制、金币宝石和历史数据都继续属于 legacy game module。

## 10. Views

production 当前已有：

```text
daily_nutrition_summary
daily_weight_summary
partner_daily_overview
```

V2-P1 的 Life 日读取先使用 `get_life_day` RPC，不急着增加额外 view。

## 11. RPC

### Existing Game / Nutrition

```text
export_home_sync_snapshot
replace_home_sync_snapshot
list_meals
create_meal_record
update_meal_record
delete_meal_record
create_chatgpt_meal_record
get_chatgpt_meal_record
```

### V2 Life

```text
get_life_day
upsert_mood_record
upsert_sleep_record
create_activity_record
update_activity_record
delete_activity_record
```

Life RPC 和私有 JSON helper 均只开放给 service-role 路径，不授权 `anon / authenticated`。

## 12. Source / AI 写入

统一来源词汇：

```text
manual
chatgpt
import
```

AI 写入 domain 统一预留：

```text
meal
mood
sleep
activity
weight
medicine
```

通用层只负责：

```text
source
idempotency key
confirmation boundary
write receipt
```

具体字段验证仍由各 domain service 负责。不存在一个可以任意修改所有表的“AI 数据表”或“AI SQL API”。

## 13. Fact vs Derived

### 事实

- daily record 原始游戏输入；
- exchange history；
- meal / meal item；
- weight measurement；
- mood entry；
- sleep record；
- activity entry；
- wallet ledger 事件；
- external write receipt。

### 派生 / 快照

- wallet current balance；
- heatmap overrides；
- week totals / streak；
- today / yesterday 游戏奖励汇总；
- nutrition / weight daily summary；
- sleep duration；
- 月度心情展示。

## 14. 权限与迁移

所有新表：

- RLS enabled；
- `anon / authenticated` 不直接获得表权限；
- Browser 必须经过 Next.js API；
- service-role 才能执行 canonical RPC；
- 新 DDL 必须新增 migration；
- 已执行历史 migration 不回改。

V2-P1 schema 对现有 production 表是 additive，不修改旧游戏和现有 meal/weight 数据。
