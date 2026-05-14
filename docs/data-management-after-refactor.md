# 重构后的数据管理说明

本文档说明当前首页数据如何划分、保存和恢复。

## 数据类型分组

核心类型在 `lib/home/types.ts`。

### UserRuntimeData

`UserRuntimeData` 表示用户在使用过程中产生或变化的数据。它偏向“运行时状态”和“业务结果”。

当前包含：

| 字段 | 说明 |
|---|---|
| `wallet` | 当前宝石和金币余额 |
| `streakDays` | 当前兼容字段，表示本周成功打卡天数 |
| `weeklySuccessDays` | 本周成功打卡天数 |
| `cumulativeSuccessDays` | 累计成功打卡天数 |
| `yesterdayGemTotal` | 昨日总宝石，用于首页展示 |
| `todayFishGems` | 今日鱼鱼宝石 |
| `todayCatGems` | 今日猫猫宝石 |
| `todayBonusGems` | 今日情侣 bonus 宝石 |
| `weekGemTotal` | 本周新增宝石 |
| `weekCoinTotal` | 本周新增金币 |
| `fishHeatmapOverrides` | 鱼鱼热力图覆盖数据 |
| `catHeatmapOverrides` | 猫猫热力图覆盖数据 |
| `dailyRecords` | 每日记录，是成长日志、热力图、统计计算的重要来源 |
| `exchangeRecords` | 兑换记录，是钱包扣减和兑换历史的重要来源 |

### AppConfigData

`AppConfigData` 表示偏配置的数据。它不是每天产生的记录，而是决定页面如何计算或展示。

当前包含：

| 字段 | 说明 |
|---|---|
| `heatmapStartDate` | 作战开始日，也是热力图起始日期设置 |
| `coinRules` | 金币规则配置，例如周起始日、连续打卡天数阈值 |
| `visualRules` | 热力图等级和运动角标阈值配置 |
| `exchangeCategories` | 兑换商品类别配置，包括名称、图标、价格、资源类型 |

### AppDataSnapshot

`AppDataSnapshot` 是持久化层保存和读取的统一数据包。

结构为：

```ts
type AppDataSnapshot = {
  version: 1;
  runtime: Partial<UserRuntimeData>;
  config: Partial<AppConfigData>;
};
```

它的作用是把“用户运行数据”和“应用配置数据”分开保存，同时保留 `version`，方便未来做数据迁移。

目前 `runtime` 和 `config` 使用 `Partial`，是为了兼容旧数据和渐进迁移。Provider 读取后会用默认值补齐缺失字段。

## Source of Truth

当前真正的业务源数据主要是：

| 数据 | 原因 |
|---|---|
| `dailyRecords` | 每日热量、运动、宝石、金币、热力图的核心来源 |
| `exchangeRecords` | 兑换消费和兑换历史的核心来源 |
| `exchangeCategories` | 兑换商品列表的核心来源 |
| `heatmapStartDate` | 热力图起始日和作战天数展示的配置来源 |
| `coinRules` | 金币计算规则来源 |
| `visualRules` | 热力图等级和运动角标规则来源 |

## Derived Data

以下数据目前会保存，但本质上可以由源数据重新计算：

| 数据 | 由什么推导 |
|---|---|
| `wallet` | `dailyRecords` 的获得记录，加上 `exchangeRecords` 的消费记录 |
| `weekGemTotal` | 当前周范围内的 `dailyRecords` |
| `weekCoinTotal` | 当前周范围内的 `dailyRecords` |
| `weeklySuccessDays` | 当前周内双方达到“一般”等级的 `dailyRecords` |
| `cumulativeSuccessDays` | 全部 `dailyRecords` 中双方达到“一般”等级的天数 |
| `yesterdayGemTotal` | 昨天的 `dailyRecords` |
| `todayFishGems` / `todayCatGems` / `todayBonusGems` | 今天的 `dailyRecords` |
| `fishHeatmapOverrides` / `catHeatmapOverrides` | `dailyRecords` 中保存的 `fishHeat` / `catHeat` |

当前仍保存这些派生数据，是为了保持现有 UI 和本地数据结构稳定。Provider 在读取时会通过 `recalculateCoinsWithCurrentRules()` 尽量重新校正。

## 当前 localStorage key

当前本地存储 key 定义在 `lib/home/app-data-store.ts`：

```ts
export const APP_DATA_STORAGE_KEY = "couple-better-game:home-resources:v1";
```

浏览器中保存的是 `AppDataSnapshot`。如果读取到旧版扁平 `HomeResourcesState`，`local-storage-app-data-store.ts` 会先转换成 snapshot。

## localStorage 当前如何保存

当前 `local-storage-app-data-store.ts` 做三件事：

1. `load()`：从 `window.localStorage` 读取字符串并 `JSON.parse()`。
2. 如果读到的是新格式 `AppDataSnapshot`，直接返回。
3. 如果读到的是旧格式 `HomeResourcesState`，调用 `snapshotFromLegacyHomeState()` 转成新格式。
4. `save()`：将 `AppDataSnapshot` 序列化为 JSON 后写回同一个 key。
5. `clear()`：删除该 key。

这个 store 是同步接口，适配当前本地 MVP。未来如果接 API，可以新建异步版本或在 service 层处理加载状态。

## memory store 的用途

`memory-app-data-store.ts` 提供 `createMemoryAppDataStore()`。

它不写浏览器，只把 snapshot 保存在内存变量里。适合：

- 后续给 Provider 或业务 service 写测试。
- 在 Storybook 或临时沙盒里模拟数据。
- 验证未来 API store 的替换边界。
- 不污染真实 `localStorage` 的本地调试。

它不是生产持久化方案，刷新页面后数据会消失。

