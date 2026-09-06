# Island Life / Legacy Game 数据边界

状态：2026-09-07。

## 1. 产品关系

当前 `couple-better-game` 已经不是旧版“变瘦变美”程序本身。

现在的产品关系是：

```text
Couple Better Game（当前主程序 / Island Life）
├─ 今日、饮食、日历、小窝等生活模块
└─ 游戏
   └─ 变瘦变美大作战（Legacy Game）
```

也就是说：**旧版“变瘦变美大作战”已经被保留下来，并收纳为当前新程序「游戏」中的一个子项目。**

它仍然可以继续运行和保留历史，但不再代表整个应用，也不属于当前生活记录的数据域。

## 2. 三个数据域

### A. Island Life：当前主程序生活数据

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

这些表承载当前生活系统的事实数据。

### B. Legacy Game：游戏子项目数据

```text
daily_records
daily_record_sides
exchange_categories
exchange_records
wallets
wallet_ledger
```

这些字段只属于「游戏 → 变瘦变美大作战」。

其中金币、宝石、钱包、兑换记录、旧版每日打卡都只是游戏资产和游戏历史，不属于 Island Life 的生活字段。

### C. Shared / System：共享基础设施

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

这些属于身份、配置、备份、通知或系统控制层，不能简单视为 Life 或 Legacy Game 的业务事实。

## 3. 强制隔离规则

```text
Island Life maintenance
≠
Legacy Game maintenance
```

任何名为“生活数据清理 / Life cleanup / 测试数据清理 / Life import / Life restore”的操作，默认只能作用于 Island Life allowlist。

除非用户明确要求操作旧游戏，否则以下 Legacy Game 表必须排除：

```text
daily_records
daily_record_sides
exchange_categories
exchange_records
wallets
wallet_ledger
```

禁止使用“最近创建的所有表 / 所有本周数据”这种跨域规则直接删除数据。

如果确实需要同时处理两个域，必须分别列出 Life 和 Legacy Game 的影响范围并分别确认。

## 4. 删除和测试数据清理

用户说：

```text
删除这一周测试数据
清空最近的生活记录
把 MCP 测试数据删掉
```

默认含义只能是 Island Life。

不能因此删除：

```text
旧版每日打卡
金币 / 宝石
wallet / wallet_ledger
兑换记录
Legacy Game 历史
```

只有用户明确说“删除旧游戏数据 / 清理变瘦变美大作战 / 清空游戏钱包”等，才进入 Legacy Game 维护流程。

## 5. AI / MCP 边界

普通 `life_query / life_mutate` 用于当前生活数据。

`legacy_home` 代表旧版游戏兼容入口，它不是普通 Life resource。旧游戏全量覆盖继续要求服务端的高风险确认规则。

AI 不得因为用户说“清生活数据”“清测试数据”而自动把 `legacy_home` 或 Legacy Game tables 纳入操作。

## 6. Import / Export / Backup

Life export、Life import、Life backup、Life restore 默认只处理当前生活域和明确的共享配置，不应携带 Legacy Game payload。

Legacy Game 的导入、覆盖、备份如需执行，必须走明确的游戏流程。

代码层 `lib/server/life-data-domains.ts` 维护当前表级 allowlist，并对混入 Legacy Game 的 Life import 做拒绝。

## 7. 工程维护规则

- 新增 Life 表时，同时更新 `ISLAND_LIFE_TABLES` 和本文件；
- 新增 Legacy Game 表时，同时更新 `LEGACY_GAME_TABLES` 和本文件；
- 旧游戏未来即使新增小游戏，也不能默认并入 Life cleanup；
- 不因为两套数据位于同一个 Supabase project，就把它们视为同一业务域；
- 当前阶段保持同一 PostgreSQL schema，采用逻辑硬隔离，不为了整理结构冒险迁移已稳定运行的旧表；
- 如果未来确实要物理迁移 schema，需要单独 migration、回归测试和 Production 变更计划。

## 8. 一句话原则

**当前主程序是 Island Life；旧版“变瘦变美大作战”是新程序「游戏」里的独立子项目。生活数据操作默认绝不能碰旧游戏数据。**
