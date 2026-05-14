# 重构后的首页架构说明

本文档说明当前 `codex-publish-current-version` 分支中首页相关代码的真实分层。当前项目仍然是纯前端本地 MVP，没有登录、数据库、后端 API 或云同步。

## 当前分层

首页相关代码目前分为三层：

| 层级 | 主要目录 | 当前职责 |
|---|---|---|
| UI 组件层 | `components/home` | 渲染首页、弹窗、热力图、成长日志、兑换商店，并调用 `useHomeResources()` |
| 规则与数据类型层 | `lib/home` | 放置结算规则、共享类型、数据快照结构、数据存储接口 |
| 持久化实现层 | `lib/home/*app-data-store.ts` | 当前使用 `localStorage` 保存，另有 memory store 供后续测试或替换 |

为了降低一次性重构风险，旧路径 `components/home/settlement-rules.ts` 和 `components/home/types.ts` 现在只是 re-export 到 `lib/home`。因此老组件可以继续使用旧 import，后续再逐步改为直接从 `@/lib/home/...` 引用。

## 关键文件职责

| 文件 | 职责 |
|---|---|
| `lib/home/types.ts` | 定义首页运行时数据、配置数据、日记录、兑换记录、钱包、热力图等共享类型 |
| `lib/home/settlement-rules.ts` | 定义宝石、金币、热力图等级、运动角标等业务规则函数 |
| `lib/home/app-data-store.ts` | 定义 `AppDataStore` 抽象，以及 state 与 snapshot 的转换函数 |
| `lib/home/local-storage-app-data-store.ts` | 当前本地持久化实现，读写浏览器 `localStorage` |
| `lib/home/memory-app-data-store.ts` | 内存版 store，适合后续测试或临时替换持久化实现 |
| `components/home/HomeResourcesProvider.tsx` | 连接 UI、规则和 store，维护 React Context 状态与首页操作函数 |

## 当前数据流

页面启动时：

1. `HomeResourcesProvider` 创建 `localStorage` store。
2. 调用 `readLocalState()` 从 store 读取 `AppDataSnapshot`。
3. 如果没有数据，则使用默认 state，并导入当前内置的 2026 年 5 月历史记录。
4. 如果存在旧版扁平数据，则通过 `snapshotFromLegacyHomeState()` 兼容转换为新 snapshot。
5. Provider 将 snapshot 合并回 `HomeResourcesState`，并用当前规则重新计算金币、热力图和统计值。

用户操作时：

1. UI 组件调用 `useHomeResources()` 暴露的方法，例如 `applyTodayRecord()`、`upsertHistoricalRecord()`、`redeemExchange()`。
2. Provider 内部根据规则函数生成或更新记录。
3. Provider 调用 `commitHomeState()` 更新 React state。
4. `commitHomeState()` 通过 `snapshotFromHomeResourcesState()` 转成 `AppDataSnapshot`。
5. 当前 store 将 snapshot 写入 `localStorage`。

## HomeResourcesProvider 当前仍承担的职责

本次只是第一步小规模拆层，所以 `HomeResourcesProvider.tsx` 仍然承担较多职责：

- 创建默认首页 state。
- 兼容旧数据读取。
- 规范化兑换类别、兑换记录、日记录。
- 导入 2026 年 5 月内置历史记录。
- 处理今日记录、补录历史、删除历史记录。
- 处理兑换、编辑兑换记录、删除兑换记录。
- 维护钱包余额、热力图覆盖数据、周统计、累计统计。
- 通过 Context 向 UI 暴露数据和操作函数。
- 调用 `AppDataStore` 保存最终 snapshot。

也就是说，Provider 已经不再直接关心 `localStorage` API，但还没有完全拆成独立的 service/reducer 层。

## 当前没有做的事情

当前架构没有新增：

- 登录系统
- Prisma
- 后端数据库
- 后端 API
- 云同步
- 规则设置页

这次重构的边界是：把规则、类型和持久化接口先移出 UI 层，让后续替换存储层更顺滑。

