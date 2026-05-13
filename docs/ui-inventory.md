# UI Inventory

本文基于当前 `app/page.tsx` 与 `components/home` 目录整理，目标是帮助后续迭代快速了解首页 UI 架构、交互流、数据来源与完成度。

## 1. 当前页面列表

| 路由 | 页面入口 | 页面定位 | 当前状态 | 备注 |
| --- | --- | --- | --- | --- |
| `/` | `app/page.tsx` -> `HomeScreen` | 情侣共同成长首页 | 完成 | 所有核心 UI 都挂载在同一个首页中，通过弹窗/Bottom Sheet 承载次级流程 |

补充说明：
- 当前没有独立的日志页、商城页、设置页。
- “记录今天”“成长日志”“恋爱宝库”“已兑换记录”“类别管理”等都属于首页内弹窗流程，而不是单独页面。

## 2. 当前组件清单

### 2.1 页面与布局组件

| 组件 | 文件 | 功能描述 | 交互逻辑 | 当前数据来源 | 状态 | 后续迭代建议 |
| --- | --- | --- | --- | --- | --- | --- |
| HomeScreen | `components/home/HomeScreen.tsx` | 首页总容器，负责拼装标题、资源面板、热力图、鼓励语、记录今天、成长日志、恋爱宝库 | 本身无复杂交互，主要负责组件顺序和页面背景氛围 | 纯静态组合；通过 `HomeResourcesProvider` 向子组件供数 | 完成 | 后续可按功能密度拆分为“概览区 / 成长区 / 奖励区”，降低单页长度 |
| GameTitle | `components/home/GameTitle.tsx` | 首页顶部品牌区，展示产品名、副标题和状态标签 | 无交互 | 静态文案 | 完成 | 后续可支持活动主题文案或节日皮肤 |
| EncouragementQuote | `components/home/EncouragementQuote.tsx` | 展示“今日小纸条”随机鼓励语 | 组件挂载时随机选一条文案，无其他交互 | 本地 `quotes` 常量 + 本地 state | 半完成 | 可改为按日期稳定选择，避免刷新频繁变化；也可接真实成长上下文推荐文案 |

### 2.2 资源与成长概览组件

| 组件 | 文件 | 功能描述 | 交互逻辑 | 当前数据来源 | 状态 | 后续迭代建议 |
| --- | --- | --- | --- | --- | --- | --- |
| HomeResourcesProvider | `components/home/HomeResourcesProvider.tsx` | 首页的本地状态容器，负责宝石、金币、周累计、连击天数、热力图覆盖值等 | 提供 `useHomeResources()`；支持 `tryRedeem()` 扣减资源，支持 `applyTodayRecord()` 应用当日记录结果 | 本地 React state；默认初始值为 0 | 半完成 | 当前无持久化、无周切换、无真实历史回放；后续可接本地存储或服务端状态层 |
| CoupleGrowthPanel | `components/home/CoupleGrowthPanel.tsx` | 首页资源总览卡，展示今日/本周宝石、本周金币、金币存量、宝石上限与双人连击 | 无主动交互，仅展示 `HomeResourcesProvider` 的聚合结果 | `useHomeResources()` | 半完成 | 现在更像实时面板，后续可补“本周重置规则”“资源变化动画”“奖励即将解锁提示” |

### 2.3 热力图与成长可视化组件

| 组件 | 文件 | 功能描述 | 交互逻辑 | 当前数据来源 | 状态 | 后续迭代建议 |
| --- | --- | --- | --- | --- | --- | --- |
| DualMonthlyHeatmaps | `components/home/DualMonthlyHeatmaps.tsx` | 组合展示双人的月度热力图和图例 | 无表单交互；会把 Provider 中的覆盖值合并进基础月历网格 | `fishHeatmapOverrides`、`catHeatmapOverrides` + `mockHeatmapData` | 半完成 | 目前月份固定为 2026 年 5 月，后续可切真实月份、支持切月与历史查看 |
| PlayerHeatmap | `components/home/PlayerHeatmap.tsx` | 渲染单人热力图网格、星期行与可访问标题 | 无点击交互；每个格子通过 `title`/`aria-label` 暴露状态 | `MonthGrid` 数据结构 | 半完成 | 可增加点击单日详情、滚动月份、周统计等功能 |
| HeatmapCell | `components/home/HeatmapCell.tsx` | 热力图单格渲染，负责颜色层级与运动角标 | Hover 放大，辅助可访问文本 | `level` / `exercise` 入参 | 完成 | 当前是纯展示单元，后续若支持点按详情，可把点击事件从父层透传进来 |
| HeatmapLegend | `components/home/HeatmapLegend.tsx` | 展示热力图颜色含义与运动角标含义 | 无交互 | 静态图例项 | 完成 | 后续若规则变化，可由规则模块生成图例配置，避免手写同步成本 |

### 2.4 记录今天流程组件

| 组件 | 文件 | 功能描述 | 交互逻辑 | 当前数据来源 | 状态 | 后续迭代建议 |
| --- | --- | --- | --- | --- | --- | --- |
| RecordTodayButton | `components/home/RecordTodayButton.tsx` | `RecordTodaySettlement` 的别名导出，保证首页调用名更直观 | 无自身逻辑 | 纯 re-export | 完成 | 可保留现状 |
| RecordTodaySettlement | `components/home/RecordTodaySettlement.tsx` | “记录今天”主流程，包含双人输入表单、实时结算预览、确认记录、成功 toast | 打开/关闭弹窗；输入体重/缺口/时长；实时预览宝石、情侣 bonus、金币变化；确认后调用 `applyTodayRecord()` 更新首页状态 | 本地输入 state + `settlement-rules` 纯函数 + `useHomeResources()` | 半完成 | 当前缺少真实历史存档、表单校验更细规则、重复记录限制、编辑历史记录回填 |

### 2.5 成长日志组件

| 组件 | 文件 | 功能描述 | 交互逻辑 | 当前数据来源 | 状态 | 后续迭代建议 |
| --- | --- | --- | --- | --- | --- | --- |
| GrowthLog | `components/home/GrowthLog.tsx` | “成长日志”入口与主弹窗，采用轻量时间线列表 + 单日详情弹窗 | 打开日志弹窗；查看单日详情；Esc/遮罩关闭；详情内保留“编辑这一天 / 删除记录”占位按钮 | `MOCK_LOGS` 本地 mock 数据 + 组件本地 state | 半完成 | 当前日志未接 `RecordTodaySettlement` 的真实结果，也没有编辑/删除的实际行为；后续可与 Provider 或存储层打通 |

### 2.6 恋爱宝库与兑换系统组件

| 组件 | 文件 | 功能描述 | 交互逻辑 | 当前数据来源 | 状态 | 后续迭代建议 |
| --- | --- | --- | --- | --- | --- | --- |
| ExchangeShop | `components/home/ExchangeShop.tsx` | “恋爱宝库”入口与主弹窗，承载固定奖励模板、兑换确认、已兑换记录弹窗、奖励模板管理、类别表单 | 打开/关闭宝库；浏览类别；调用 `tryRedeem()` 确认兑换；输入备注；查看 mock 兑换历史；切换管理模式；新增/编辑/删除类别 | `useHomeResources()` 提供的 `gemStock` / `coinStock` / `tryRedeem()` + `DEFAULT_CATEGORIES` 本地 state + `MOCK_REDEEM_RECORDS` | 半完成 | 当前“类别管理”只存在于本地 state；历史记录仍是 mock；新增类别不持久，刷新丢失；后续可补真实兑换流水与类别配置保存 |

## 3. 支撑模块清单

这些文件不是直接渲染页面的 React 组件，但它们决定了首页 UI 如何工作。

| 模块 | 文件 | 功能描述 | 当前数据来源 | 状态 | 后续迭代建议 |
| --- | --- | --- | --- | --- | --- |
| settlement-rules | `components/home/settlement-rules.ts` | 记录今天的核心规则层，负责解析输入、热力图分级、运动标签、单人宝石、情侣 bonus、金币奖励、结算日 | 纯函数，无外部状态 | 完成 | 规则已集中，后续可抽成更清晰的“配置 + 引擎”结构，便于调参 |
| mockHeatmapData | `components/home/mockHeatmapData.ts` | 提供 2026 年 5 月热力图基础网格、日期标签和覆盖函数 | 本地静态网格 + 空白月份默认值 | 半完成 | 当前月份固定且默认全灰，后续可改为动态日历生成器 |
| types | `components/home/types.ts` | 定义热力图相关类型：`HeatLevel`、`ExerciseTag`、`HeatmapDay` | 类型声明 | 完成 | 若日志和兑换系统继续扩展，可新增统一的领域类型文件 |

## 4. 当前组件交互逻辑总览

### 4.1 首页主链路

1. `app/page.tsx` 只负责渲染 `HomeScreen`。
2. `HomeScreen` 用 `HomeResourcesProvider` 包裹整个首页。
3. 所有资源展示、兑换扣减、记录今天更新，都通过 `useHomeResources()` 在首页内部流转。

### 4.2 记录今天链路

1. 用户点击“记录今天”。
2. `RecordTodaySettlement` 打开弹窗，分别录入 🐟 / 🐱 的体重、运动时长、热量缺口。
3. 组件即时调用 `settlement-rules` 生成预览。
4. 用户确认后，调用 `applyTodayRecord()`：
   - 增加宝石
   - 增加金币
   - 增加连击天数
   - 覆盖当天热力图格子
5. 首页资源面板和热力图立即更新。

### 4.3 成长日志链路

1. 用户点击“成长日志”。
2. `GrowthLog` 打开主弹窗，显示 mock 时间线列表。
3. 点击“查看”后，打开单日详情弹层。
4. “编辑这一天 / 删除记录”当前只保留 UI 壳子，不会改数据。

### 4.4 恋爱宝库链路

1. 用户点击“兑换商店”。
2. `ExchangeShop` 打开主弹窗，默认进入奖励模板浏览模式。
3. 用户可：
   - 点击“兑换”打开确认弹层并输入备注
   - 点击“查看记录”查看 mock 历史
   - 点击“管理类别”切到模板管理模式
4. 确认兑换时，调用 Provider 的 `tryRedeem()` 扣除资源。
5. 成功后只显示 toast，不会写入真实历史记录。
6. 类别新增/编辑/删除只修改组件本地 state，刷新页面后丢失。

## 5. 当前数据来源总览

### 5.1 Provider 本地状态

由 `HomeResourcesProvider` 持有：
- `gemStock`
- `coinStock`
- `streakDays`
- `todayFishGems`
- `todayCatGems`
- `weekGemTotal`
- `weekCoinTotal`
- `fishHeatmapOverrides`
- `catHeatmapOverrides`

特点：
- 当前仅存在于内存中。
- 页面刷新后会回到初始状态。

### 5.2 规则层纯函数

由 `settlement-rules.ts` 提供：
- 表单输入解析
- 热力图等级映射
- 运动标签映射
- 单人宝石计算
- 情侣 bonus 计算
- 金币奖励计算
- 结算日计算

特点：
- 不直接保存数据。
- 只负责从输入推导结果。

### 5.3 本地 mock 数据

当前仍在使用的 mock / 静态数据：
- `mockHeatmapData.ts` 中的基础月份网格
- `GrowthLog.tsx` 中的 `MOCK_LOGS`
- `ExchangeShop.tsx` 中的 `DEFAULT_CATEGORIES`
- `ExchangeShop.tsx` 中的 `MOCK_REDEEM_RECORDS`
- `EncouragementQuote.tsx` 中的 `quotes`

## 6. 当前完成度判断

### 完成

- 首页单页骨架与视觉主题
- 资源面板基础展示
- 热力图基础展示与图例
- 记录今天的表单输入与即时结算
- 兑换扣减入口的基本行为
- 各主弹窗的打开/关闭、遮罩、Esc 关闭、锁滚动

### 半完成

- 首页整体数据仍然是“本地原型状态”，缺少持久化
- 热力图月份固定，无法切换真实月份
- 成长日志尚未接入真实历史来源
- 兑换历史尚未接入真实兑换流水
- 奖励模板管理只保存在组件内本地 state

### 待完善

- 真正的历史记录持久化
- 周期重置逻辑（如本周统计）
- 日志编辑/删除真实行为
- 兑换记录新增到历史列表
- 奖励模板跨刷新保留
- 多页面或更清晰的信息架构

## 7. 后续迭代建议

1. 先统一“数据真相来源”。
   当前首页资源、日志、奖励模板、兑换历史分散在 Provider state 和多个 mock 常量中。下一阶段最好先定义一个统一的前端领域模型，再决定是否接本地存储或服务端。

2. 让成长日志和记录今天打通。
   现在用户记录了今天，资源面板和热力图会更新，但成长日志不会新增真实记录。这是最明显的体验断层。

3. 让恋爱宝库形成闭环。
   现在兑换可以真实扣资源，但“已兑换记录”仍是 mock，类别管理也只存在当前会话。后续应优先把兑换结果写入前端真实历史，再考虑类别模板持久化。

4. 把热力图从“固定五月”升级成“真实月份组件”。
   当前交互已经足够说明产品方向，下一步更值得投入的是把日期系统做真实，而不是继续堆 UI 皮肤。

5. 处理几个现存实现风险。
   `EncouragementQuote.tsx` 与 `RecordTodaySettlement.tsx` 这类组件中，仍有一些依赖 effect 驱动 UI 状态的写法；如果后续继续严格 lint 或升级 React 规则，建议统一清理。
