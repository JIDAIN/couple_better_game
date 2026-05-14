# 重构后的模块地图

本文档按目录说明当前首页相关模块的职责，方便后续继续拆分。

## 顶层页面

| 文件 | 说明 |
|---|---|
| `app/page.tsx` | 应用首页入口，渲染首页组件 |

## components/home

这里仍然是 UI 组件主目录。当前目标是保持视觉和交互不变，因此大部分组件仍在这里。

| 文件 | 当前职责 |
|---|---|
| `HomeScreen.tsx` | 首页整体布局，组合标题、资源面板、热力图、记录入口、成长日志和兑换商店入口 |
| `GameTitle.tsx` | 首页主标题区域 |
| `CoupleGrowthPanel.tsx` | 宝石、金币、昨日宝石、打卡统计等首页资源面板 |
| `RecordTodaySettlement.tsx` | 记录今天和补录历史记录弹窗，调用结算规则预览宝石和金币 |
| `GrowthLog.tsx` | 成长日志弹窗，按月展示真实 `dailyRecords` |
| `ExchangeShop.tsx` | 恋爱宝库，展示兑换类别、发起兑换、管理类别、查看和编辑兑换记录 |
| `DualMonthlyHeatmaps.tsx` | 双人月度热力图，支持月份切换和起始日设置 |
| `HeatmapLegend.tsx` | 热力图图例 |
| `PlayerHeatmap.tsx` | 单人热力图网格渲染 |
| `mockHeatmapData.ts` | 当前热力图日期网格、月份、作战天数等日期工具函数 |
| `HomeResourcesProvider.tsx` | 首页数据 Context Provider，连接 UI、规则和数据 store |
| `settlement-rules.ts` | 兼容旧 import 的 re-export，真实实现已移到 `lib/home/settlement-rules.ts` |
| `types.ts` | 兼容旧 import 的 re-export，真实类型已移到 `lib/home/types.ts` |

## lib/home

这里是本次重构后新增的规则、类型和数据管理层。

| 文件 | 当前职责 |
|---|---|
| `types.ts` | 统一定义首页领域类型、运行时数据、配置数据和持久化 snapshot |
| `settlement-rules.ts` | 宝石、金币、情侣 bonus、热力图等级、运动角标等纯规则函数 |
| `app-data-store.ts` | `AppDataStore` 接口、storage key、snapshot 判断和转换函数 |
| `local-storage-app-data-store.ts` | 当前浏览器 `localStorage` 持久化实现 |
| `memory-app-data-store.ts` | 内存 store，用于后续测试、替换或沙盒调试 |

## docs

| 文件 | 说明 |
|---|---|
| `rules-confirmation.md` | 记录结算规则与 UI 对应关系 |
| `heatmap-date-logic.md` | 热力图日期落位与周六起始周逻辑 |
| `ui-inventory.md` | 现有 UI 和功能盘点 |
| `architecture-after-refactor.md` | 本次重构后的架构说明 |
| `data-management-after-refactor.md` | 本次重构后的数据管理说明 |
| `module-map-after-refactor.md` | 本次重构后的模块地图 |
| `development-guide-after-refactor.md` | 后续开发和继续拆分建议 |

## 重要依赖方向

推荐依赖方向：

```text
components/home UI
  -> HomeResourcesProvider
  -> lib/home/settlement-rules
  -> lib/home/types
  -> lib/home/app-data-store
  -> lib/home/local-storage-app-data-store
```

后续应避免让 `lib/home` 反向依赖 `components/home`。`lib/home` 应该逐步成为可测试、可替换、可复用的业务层。

## 当前仍未完全拆出的部分

`HomeResourcesProvider.tsx` 当前仍然包含较多业务编排逻辑，例如：

- 默认兑换类别。
- 历史记录导入。
- 数据规范化。
- 钱包重算。
- 今日记录和补录历史记录写入。
- 兑换记录写入、编辑、删除。
- 热力图 overrides 构建。

这些逻辑后续可以继续拆到 `lib/home` 下的 service 或 reducer 文件里，但本次文档任务不继续修改运行时代码。

