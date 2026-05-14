# 重构后的开发指南

本文档说明在当前架构下应该如何继续开发，尤其是如何避免重新把 UI、业务规则和数据管理混在一起。

## 新增或修改业务规则

优先修改：

- `lib/home/settlement-rules.ts`
- 必要时补充 `lib/home/types.ts`

不要把新的宝石、金币、热力图等级、运动角标规则直接写进 UI 组件。

如果 UI 只是展示规则结果，应调用规则函数，例如：

- `gemsFromDeficit()`
- `gemsFromExercise()`
- `computeRecoveryBonus()`
- `computeCoupleBonus()`
- `computeCoinPreview()`
- `buildHeatmapDay()`

## 新增数据字段

先判断字段属于哪一类。

如果是用户操作产生的数据，优先放入 `UserRuntimeData`。例如新的记录、消费、累计状态。

如果是可配置规则或展示配置，优先放入 `AppConfigData`。例如阈值、商品类别、起始日期。

如果字段只是可以从 `dailyRecords` 或 `exchangeRecords` 推导出来，优先考虑不要把它作为新的 source of truth。当前项目里保留了一些派生字段，是为了兼容已有 UI 和本地存储，后续可以逐步减少。

## 新增持久化方式

后续如果接 API 或数据库，优先替换 `AppDataStore` 实现，而不是先改 UI。

推荐步骤：

1. 保留 `AppDataStore` 接口。
2. 新增一个实现，例如 `api-app-data-store.ts`。
3. 让新 store 负责把远端数据转换为 `AppDataSnapshot`。
4. Provider 继续消费 `AppDataSnapshot`。
5. 等 API 稳定后，再考虑把同步 store 接口升级为异步加载流程。

当前需要优先替换的层是：

```text
lib/home/local-storage-app-data-store.ts
```

而不是：

```text
components/home/ExchangeShop.tsx
components/home/GrowthLog.tsx
components/home/DualMonthlyHeatmaps.tsx
```

UI 组件应该尽量不知道数据来自 `localStorage`、API 还是数据库。

## 后续继续拆分 Provider 的建议顺序

`HomeResourcesProvider.tsx` 当前仍然较大。建议按下面顺序继续拆，不要一次性重写。

### 第一步：抽默认数据和规范化函数

可拆到：

- `lib/home/default-home-data.ts`
- `lib/home/normalize-home-data.ts`

适合迁出的内容：

- `DEFAULT_EXCHANGE_CATEGORIES`
- `normalizeExchangeCategories()`
- `normalizeVisualRules()`
- `normalizeCoinRules()`
- `normalizeDailyRecord()`
- `normalizeExchangeRecord()`

### 第二步：抽统计和钱包计算

可拆到：

- `lib/home/home-statistics.ts`
- `lib/home/wallet-calculation.ts`

适合迁出的内容：

- `recordGems()`
- `countSuccessfulCheckInsInWeek()`
- `countSuccessfulCheckInsTotal()`
- `sumRecordGemsInCoinWeek()`
- `sumRecordCoinsInCoinWeek()`
- `computeGemWallet()`
- `recalculateCoinsWithCurrentRules()`

### 第三步：抽记录写入 service

可拆到：

- `lib/home/daily-record-service.ts`
- `lib/home/exchange-service.ts`

适合迁出的内容：

- 今日记录生成。
- 历史记录 upsert。
- 历史记录删除。
- 兑换记录生成。
- 兑换记录编辑和删除。

Provider 最终只保留 React Context、state dispatch、store load/save。

### 第四步：再考虑 reducer

当 service 拆出后，可以考虑把状态更新改成 reducer。

目标不是追求抽象，而是让每个操作可测试：

- `applyTodayRecord`
- `upsertHistoricalRecord`
- `deleteHistoricalRecord`
- `redeemExchange`
- `updateExchangeRecord`
- `deleteExchangeRecord`

## 测试建议

当前 `package.json` 还没有 test script。后续补测试时，优先测试纯函数：

- `lib/home/settlement-rules.ts`
- 后续拆出的统计函数
- 后续拆出的 wallet 计算函数
- `memory-app-data-store.ts`

测试时可以用 `createMemoryAppDataStore()`，避免污染浏览器 `localStorage`。

## 开发边界

当前阶段不要新增：

- 登录系统
- Prisma
- 后端数据库
- 后端 API
- 云同步

如果确实要接远端数据，应先让远端实现适配 `AppDataStore` 的数据形状，再逐步修改 Provider 加载流程。

