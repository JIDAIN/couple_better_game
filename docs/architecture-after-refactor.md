# 重构后的架构说明

本文档描述当前 `codex-publish-current-version` 分支中首页相关代码的真实分层。项目目前仍然是纯前端 Web MVP，没有登录、数据库、后端 API 或云同步。

## 总体分层

当前首页相关代码可以按职责分成四层：

| 层级 | 目录 | 主要职责 |
|---|---|---|
| 页面层 | `app/` | Next.js 页面入口和路由挂载 |
| 组件层 | `components/home/` | UI 展示、交互、弹窗、Context 消费 |
| 领域与数据层 | `lib/home/` | 类型、规则、服务、存储抽象、日期工具、默认配置、seed 数据 |
| 测试层 | `tests/home/` | 保护结算规则、存储抽象、状态恢复、业务服务的单元测试 |

## 当前组件层

`components/home/` 主要负责界面展示与动作触发。最关键的组件是 `HomeResourcesProvider.tsx`，它现在已经从原来的大文件缩短成一个薄状态编排器。

### `HomeResourcesProvider.tsx` 现在负责什么

它现在主要负责：

- 创建 `HomeResourcesContext`
- 暴露 `useHomeResources()`
- 初始化 `AppDataStore`
- 读取和写回 `HomeResourcesState`
- 把服务层计算结果提交进 React state
- 对外暴露 action，例如 `applyTodayRecord`、`redeemExchange`、`upsertHistoricalRecord` 等
- 把当前 state 拼装成 Context value 提供给 UI

### `HomeResourcesProvider.tsx` 现在不再负责什么

经过多步拆分之后，Provider 已经不再直接承担这些纯业务/存储细节：

- 不再直接实现结算规则
- 不再直接实现每日记录、历史补录、兑换记录的纯计算
- 不再直接实现钱包重算和统计汇总
- 不再直接拼装 snapshot
- 不再直接处理 localStorage 读写细节
- 不再直接保存默认配置和 seed 常量

这些职责已经分散到 `lib/home` 下的 service / store / rules 文件里。

## `lib/home/` 当前职责地图

### `types.ts`

统一定义领域类型，是整个首页数据层的类型入口。

它包含：

- `UserRuntimeData`
- `AppConfigData`
- `AppDataSnapshot`
- `HomeResourcesState`
- `DailyRecord`
- `ExchangeRecord`
- `ExchangeCategory`
- `Wallet`
- `HeatmapDay`
- `TodayRecordPayload`
- `HistoricalRecordDraft`
- `HistoricalRecordResult`

### `settlement-rules.ts`

纯结算规则层。这里放的是不会直接触碰 UI、store 或 React state 的业务规则：

- 热量缺口对应的宝石规则
- 运动宝石规则
- 恢复日奖励
- 情侣 bonus
- 金币规则
- 热力图等级与运动角标规则
- `computeCoinPreview()`
- `buildHeatmapDay()`

### `app-data-store.ts`

数据存储接口层和 snapshot 转换层。

它定义：

- `AppDataStore`
- `isAppDataSnapshot()`
- `snapshotFromHomeResourcesState()`
- `snapshotFromLegacyHomeState()`
- `homeStatePatchFromSnapshot()`

### `local-storage-app-data-store.ts`

当前浏览器本地存储实现。它只关心：

- 从 `localStorage` 读取字符串
- 解析 JSON
- 识别 snapshot 或 legacy 数据
- 写回 JSON
- 清理 storage key

### `memory-app-data-store.ts`

内存版 store，主要给测试和未来替换实现使用。它不会碰浏览器，也不会触碰 `localStorage`。

### `home-state-service.ts`

状态初始化与恢复服务。它负责：

- 创建默认 state
- 从 `AppDataStore` 读取 snapshot
- 兼容 legacy 数据
- 规范化默认值、规则、记录、分类
- 导入 seed 历史记录
- 重算派生字段
- 写回 snapshot

### `home-stat-service.ts`

统计计算服务。它负责：

- 钱包重算
- 本周宝石和金币统计
- 成功打卡统计
- seed 历史数据导入时的重算
- 相关汇总函数

### `daily-record-service.ts`

每日记录服务。它负责：

- 今日记录生成
- 今日记录应用到 state
- 历史记录补录
- 历史记录删除
- 这些 action 的纯计算部分

### `exchange-service.ts`

兑换服务。它负责：

- 兑换分类归一化
- 兑换分类增删改的纯计算
- 兑换记录归一化
- 兑换记录排序
- 兑换记录创建

### `date-utils.ts`

日期工具。它负责：

- 日期格式化
- ISO 日期解析
- 兑换时间格式化
- 日期归一化

### `daily-record-utils.ts`

每日记录通用工具。它负责：

- `DailyRecord` 归一化
- 记录日期提取
- 记录查找
- 记录排序
- 热力图 override 构建

### `home-default-config.ts`

默认配置集中地，保存默认分类等静态配置。

### `home-seed-data.ts`

seed 历史数据集中地，保存内置的 5 月历史记录导入数据。

## Provider 当前的定位

现在的 `HomeResourcesProvider.tsx` 已经更接近“状态编排器”而不是“业务规则容器”。

它做的事情更像这样：

1. 从 `home-state-service.ts` 读取初始 state
2. 把 state 放进 React
3. 提供 `commitHomeState()`
4. 在 action 中调用各个 service
5. 把结果写回 store
6. 通过 Context 让 UI 消费状态和动作

这意味着：

- UI 不直接访问 `localStorage`
- UI 不直接实现结算规则
- UI 不直接做钱包或统计重算
- UI 不直接处理 snapshot 恢复

## 目前的边界

当前还没有做的事情：

- 没有登录系统
- 没有 Prisma
- 没有后端数据库
- 没有后端 API
- 没有云同步

当前边界的目标很明确：先把业务规则、数据恢复和存储抽象成可替换层，后续再把 `AppDataStore` 替换成远程实现。  
# 当前实现同步说明（2026-05）

当前重构后架构包含导入导出服务：`lib/home/export-service.ts`、`lib/home/import-service.ts`，以及首页入口 `components/home/DataManagement.tsx`。热力图动态网格生成位于 `components/home/mockHeatmapData.ts`。
