# 重构后的数据管理说明

本文档说明当前首页数据如何划分、保存、恢复和重算。

## 数据分层

当前首页数据分成两类：

1. 用户运行数据 `UserRuntimeData`
2. 配置数据 `AppConfigData`

再加上一层持久化快照 `AppDataSnapshot`，用于本地存储和未来远程同步。

## `UserRuntimeData`

`UserRuntimeData` 表示“用户运行时产生或变化的数据”。这些字段会随着打卡、兑换、补录等行为变化。

当前包括：

- `wallet`
- `streakDays`
- `weeklySuccessDays`
- `cumulativeSuccessDays`
- `yesterdayGemTotal`
- `todayFishGems`
- `todayCatGems`
- `todayBonusGems`
- `weekGemTotal`
- `weekCoinTotal`
- `fishHeatmapOverrides`
- `catHeatmapOverrides`
- `dailyRecords`
- `exchangeRecords`

其中：

- `dailyRecords` 是每日记录主表
- `exchangeRecords` 是兑换记录主表
- `wallet`、`weekGemTotal`、`weekCoinTotal`、`streakDays` 等属于可重算字段

## `AppConfigData`

`AppConfigData` 表示“配置类数据”，也就是影响计算和展示方式的静态参数。

当前包括：

- `heatmapStartDate`
- `coinRules`
- `visualRules`
- `exchangeCategories`

这些数据不是每天产生的记录，而是决定规则或展示方式的配置。

## `AppDataSnapshot`

当前 snapshot 的结构是：

```ts
type AppDataSnapshot = {
  version: 1;
  runtime: Partial<UserRuntimeData>;
  config: Partial<AppConfigData>;
};
```

这样拆分的原因有三个：

1. 把“用户数据”和“配置数据”分开，后续更容易迁移
2. 给未来后端/API/数据库同步留出明确边界
3. 允许历史数据逐步兼容，不要求一次性全量升级

`runtime` 和 `config` 目前使用 `Partial`，是为了兼容旧数据和渐进式补字段。

## 当前存储方案

当前本地存储仍然使用浏览器 `localStorage`。

存储 key 定义在：

```ts
couple-better-game:home-resources:v1
```

当前分工是：

- `local-storage-app-data-store.ts` 只负责读、写、清理
- `home-state-service.ts` 负责恢复、规范化、fallback、legacy 兼容
- `app-data-store.ts` 负责 snapshot 和 state 之间的转换

也就是说，`localStorage` 本身只是一个字节载体，真正的业务恢复逻辑不放在 UI 里。

## Source of Truth 与 Derived Data

### 当前的核心 source of truth

当前最重要的源数据是：

- `dailyRecords`
- `exchangeRecords`
- `exchangeCategories`
- `heatmapStartDate`
- `coinRules`
- `visualRules`

这些字段决定了首页的真实内容和后续可重算结果。

### 当前的 derived data

以下字段可以从源数据重算出来：

- `wallet`
- `weekGemTotal`
- `weekCoinTotal`
- `streakDays`
- `weeklySuccessDays`
- `cumulativeSuccessDays`
- `yesterdayGemTotal`
- `todayFishGems`
- `todayCatGems`
- `todayBonusGems`
- `fishHeatmapOverrides`
- `catHeatmapOverrides`

目前这些派生字段仍然会一起存进 snapshot，原因是：

1. 方便当前 UI 快速展示
2. 保持现有 localStorage 结构稳定
3. 便于渐进式重构，不影响现有行为

后续如果接数据库，可以重新评估哪些派生字段要持久化、哪些只在读取时重算。

## 当前恢复流程

当前恢复大致是：

1. `HomeResourcesProvider` 创建 `AppDataStore`
2. `home-state-service.ts` 通过 `dataStore.load()` 读 snapshot
3. 如果没有 snapshot，就创建默认 state，再导入 seed 历史记录并重算
4. 如果读到 snapshot，就恢复到 `HomeResourcesState`
5. 对 `dailyRecords`、`exchangeRecords`、`exchangeCategories`、规则字段做规范化
6. 再调用统计重算，保证 wallet 和汇总字段与当前规则一致

## 未来接后端时优先替换哪一层

如果未来接 API 或数据库，优先替换的是：

1. `AppDataStore` 的实现
2. 然后再决定 `home-state-service.ts` 是否改成异步加载

建议的远程实现可以叫：

- `remote-api-app-data-store.ts`
- 或 `api-app-data-store.ts`

这样 UI 和 Provider 理论上不需要大改，只要继续面向 `AppDataStore` 接口工作即可。

## 当前的兼容策略

当前项目对旧数据采取的是“先兼容，再规范化，再重算”策略。

这意味着：

- 旧 snapshot 还能读
- 缺字段会用默认值补齐
- 每次恢复后都会尽量回到当前规则计算结果

这个策略对现在的本地 MVP 很重要，因为它能保证重构过程中不会把历史数据弄丢。  
