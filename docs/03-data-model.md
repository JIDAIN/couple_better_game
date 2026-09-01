# 数据模型与 Source of Truth

## 1. 目标

这份文档描述**当前生产 Supabase schema + 当前前端模型**，不再描述“未来可能使用的数据库草案”。

最重要的原则：

```text
事实数据优先保存
派生数据允许缓存，但必须可从事实重算
饮食 / deficit / 体重 / 运动不混域
```

## 2. 四个领域

### 2.1 饮食摄入

真相源：

- `meals`
- `meal_items`

可选知识层：

- `foods`
- `food_aliases`

`meal_items.raw_name` 必须保留。没有 canonical food 时 `food_id` 可以为空。

### 2.2 游戏 deficit 与运动

真相源：

- `daily_records`
- `daily_record_sides`

`daily_record_sides` 中：

- `deficit_kcal`：现有游戏 deficit
- `exercise_minutes`：游戏当天运动分钟
- `weight_kg`：当天游戏体重快照

### 2.3 体重趋势

真相源：

- `weight_measurements`

它允许按实际测量时间保存多条记录，是未来趋势图的主要来源。

### 2.4 目标周期

- `partner_goal_periods`

保存有效期内的目标体重、目标摄入、maintenance kcal 等配置。当前只有 schema，尚无产品 UI。

## 3. 游戏核心表

### `couple_spaces`

一个情侣空间。当前生产使用固定 slug；包含 `home_sync_updated_at` 作为兼容快照更新时间。

关键字段：

```text
id
slug
name
archived_at
home_sync_updated_at
```

### `partner_profiles`

空间内的 `fish / cat` 两个角色：

```text
couple_space_id
partner_key
nickname
emoji
auth_user_id nullable
```

`auth_user_id` 目前没有形成完整账号系统。

### `app_configs`

空间级游戏配置：

```text
heatmap_start_date
coin_week_start_day
coin_deficit_streak_days
visual_rules jsonb
```

**已知 drift：**数据库列 `coin_deficit_streak_days` 的 schema default 仍为 7，而当前代码默认和生产配置均为 5。新空间功能上线前必须通过 migration 统一这个默认值。

### `daily_records`

一天一条双人主记录：

```text
record_date
bonus_gems
coin_delta
note
deleted_at
legacy_id
```

这里部分列名来自旧 currency semantics，不能只看名称判断用户可见币种，见 `05-business-rules.md`。

### `daily_record_sides`

每天两个角色各一条：

```text
partner_key
weight_kg
deficit_kcal
exercise_minutes
gems
heat_level
exercise_tag
```

原始事实主要是 `weight_kg / deficit_kcal / exercise_minutes`；奖励和 heat 字段是当前规则下的结果快照。

### `exchange_categories`

当前奖励模板：标题、图标、说明、资源类型、价格、active 状态。

### `exchange_records`

兑换历史事实。保存兑换当时快照：

```text
category_title
icon
resource_kind
price
remark
occurred_at
```

即使分类以后改名或删除，历史记录仍独立成立。

## 4. 钱包

### `wallet_ledger`

资源变动审计事实：

```text
resource_kind
delta
balance_after
reason_type
reason_id
description
occurred_at
```

### `wallets`

当前余额快照：

```text
gems
coins
```

余额是可派生状态，不应成为唯一事实来源。兼容快照导入时数据库会根据游戏记录/兑换重建钱包。

## 5. 营养表

### `meals`

一餐的头记录：

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

约束：

- partner 只能 fish/cat；
- meal type：breakfast/lunch/dinner/snack/other；
- snack_period 只允许 snack；
- calorie estimate 必须位于 min/max 内；
- `idempotency_key` 在同一 space 唯一。

### `meal_items`

一餐内食物明细：

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

删除 meal 时 items 级联删除。

### `foods`

空间级 canonical food：名称、category、默认每 100g 热量和 macros。

### `food_aliases`

把自然语言别名指向 canonical food；可以是空间共享 alias，也可以按 partner 个性化。

别名解析失败不能阻止 meal 保存。

## 6. 体重表

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

设计目标：

- 保留真实测量时间；
- 可以关联旧游戏记录；
- 不因为更新每日快照而删除独立测量历史。

## 7. Views

当前生产有：

- `daily_nutrition_summary`
- `daily_weight_summary`
- `partner_daily_overview`

它们用于把规范化事实聚合为按天读取的视图。当前 Web UI 尚未全面消费这些 view。

## 8. 当前 RPC

```text
export_home_sync_snapshot
replace_home_sync_snapshot
list_meals
create_meal_record
update_meal_record
delete_meal_record
```

游戏 RPC 负责 legacy snapshot 与规范化表之间转换；meal 写入 RPC 负责事务一致性。

## 9. 前端兼容模型

`lib/home/types.ts` 仍保留：

```text
HomeResourcesState
UserRuntimeData
AppConfigData
AppDataSnapshot v1
DailyRecord
ExchangeRecord
```

原因是当前 UI、localStorage 备份和云端兼容接口仍围绕这套 shape 工作。

因此当前系统同时有两层数据模型：

```text
Browser compatibility snapshot
           ⇅ RPC mapping
Normalized Supabase schema
```

不要把这理解成数据库重复设计；这是迁移期的兼容边界。

## 10. Fact vs Derived

### 事实 / 用户配置

- daily record 原始输入
- exchange history
- meal / meal item
- weight measurement
- exchange category / app config / goal period
- wallet ledger 事件

### 派生 / 快照

- wallet current balance
- heatmap overrides
- week totals
- success days / streak
- today / yesterday summary
- daily nutrition/weight overview views

历史事实发生变化后，派生数据必须重建。

## 11. Schema 版本控制现状

生产数据库已经完成规范化 schema 和 RPC 建设，但**早期创建这些结构的 migration SQL 没有完整保存在当前仓库**。

这意味着当前数据库是可运行的，但从空数据库完全复现 production schema 的能力不够清晰。

因此 roadmap P0 是：

1. 将当前 production schema / functions / grants 回填为版本化 migration；
2. 从此所有 DDL 都先形成 migration；
3. 建立“新环境可复现”验证流程。
