
# 架构说明文档：双人变美变瘦大作战

# 1. 文档目的

本文档说明项目当前的代码分层、模块职责、文件放置规则、模块依赖关系，以及未来从本地存储迁移到后端 API 时的架构原则。

核心目标是保证：

```text
UI 只负责展示和交互
Provider 只负责状态编排
业务规则保持纯函数
Store 负责数据来源
服务层负责业务状态变更
未来替换后端时尽量少改 UI
```

---

# 2. 当前技术栈

当前项目是基于 Next.js、React、TypeScript、Tailwind CSS 构建的 Web 应用。项目脚本包括 `dev`、`build`、`start`、`lint`、`test` 等，依赖中包含 Next.js、React、React DOM、Tailwind CSS、TypeScript 和 Vitest。

当前阶段为 Web MVP，主要数据来源是浏览器本地存储。

---

# 3. 总体分层架构

当前项目推荐理解为 6 层：

```text
app/
  ↓
components/
  ↓
HomeResourcesProvider
  ↓
lib/home service 层
  ↓
lib/home rules / stat 纯函数层
  ↓
AppDataStore 存储抽象层
```

## 3.1 分层说明

| 层级       | 目录 / 文件                                                         | 主要职责                           |
| ---------- | ------------------------------------------------------------------- | ---------------------------------- |
| 页面入口层 | `app/`                                                            | Next.js 路由和页面入口             |
| UI 组件层  | `components/`                                                     | 展示、交互、弹窗、表单             |
| 状态编排层 | `components/home/HomeResourcesProvider.tsx`                       | 聚合全局状态和操作方法             |
| 业务服务层 | `lib/home/*-service.ts`                                           | 每日记录、兑换、状态恢复等业务变更 |
| 规则计算层 | `lib/home/settlement-rules.ts`、`home-stat-service.ts`          | 宝石、金币、热力图、统计等纯计算   |
| 存储抽象层 | `lib/home/app-data-store.ts`、`local-storage-app-data-store.ts` | 数据读写来源抽象                   |

---

# 4. 目录职责

## 4.1 `app/`

### 职责

`app/` 是 Next.js 页面入口层。

它负责：

```text
页面路由
根页面渲染
连接顶层页面组件
```

当前首页 `app/page.tsx` 渲染 `HomeScreen`，具体页面逻辑下沉到 `components/home`。

### 放置规则

适合放：

```text
page.tsx
layout.tsx
globals.css
全局样式入口
```

不适合放：

```text
业务计算规则
复杂状态逻辑
兑换逻辑
每日记录结算逻辑
localStorage 访问逻辑
```

---

## 4.2 `components/`

### 职责

`components/` 是 UI 组件层。

它负责：

```text
页面展示
按钮交互
弹窗展示
表单输入
视觉状态
toast 显示
用户触发操作
```

当前首页由 `HomeScreen` 组合多个组件，包括标题、成长面板、成长地图、鼓励语、记录按钮、成长日志和兑换商店。

### 组件示例

```text
components/home/HomeScreen.tsx
components/home/CoupleGrowthPanel.tsx
components/home/RecordTodaySettlement.tsx
components/home/DualMonthlyHeatmaps.tsx
components/home/GrowthLog.tsx
components/home/ExchangeShop.tsx
components/home/EncouragementQuote.tsx
```

### 放置规则

适合放：

```text
JSX 结构
className
组件内部 UI 状态
弹窗 open/close 状态
输入框临时值
按钮点击事件
```

不适合放：

```text
宝石规则
金币规则
钱包回算
localStorage 直接读写
复杂业务状态变更
数据归一化逻辑
```

---

# 5. 页面组合层：HomeScreen

## 5.1 职责

`HomeScreen` 是首页组件编排层。

它负责把首页各功能组件组合起来：

```text
GameTitle
CampaignProgressBadge
CoupleGrowthPanel
DualMonthlyHeatmaps
EncouragementQuote
RecordTodayButton
GrowthLog
ExchangeShop
```

这些组件都被 `HomeResourcesProvider` 包裹，以便共享状态。

## 5.2 架构原则

`HomeScreen` 只做页面组合，不应承担业务逻辑。

它可以：

```text
决定组件顺序
决定布局结构
放置背景装饰
放置入口按钮
```

不应：

```text
直接计算宝石
直接读写 localStorage
直接修改 dailyRecords
直接处理兑换逻辑
```

---

# 6. 状态编排层：HomeResourcesProvider

## 6.1 文件位置

```text
components/home/HomeResourcesProvider.tsx
```

## 6.2 职责

`HomeResourcesProvider` 是当前项目的状态编排器。

它负责：

```text
创建全局 Context
初始化 homeState
从 Store 读取数据
把服务层函数包装成 UI 可调用方法
提交状态变更
把状态写回 Store
向组件暴露数据和操作
```

它暴露的 Context 中包含宝石、金币、连续天数、每日记录、兑换记录、兑换类别、记录增删改、兑换记录更新删除、热力图起始日更新、奖励类别管理等能力。

## 6.3 当前工作方式

Provider 内部创建 `dataStore`，初始化默认状态，并在挂载后读取本地存储中的真实数据。状态提交时通过 `commitHomeState` 更新 React state，并写入存储。

## 6.4 架构原则

Provider 只负责  **状态编排** 。

它可以：

```text
调用 service
组合 state
提交 state
暴露 action
处理本地状态同步
```

不应：

```text
直接写复杂业务规则
直接写宝石金币计算细节
把 UI 状态写进业务状态
让 UI 绕过 Provider 修改数据
```

---

# 7. 类型层：`lib/home/types.ts`

## 7.1 职责

`types.ts` 是项目的数据模型定义层。

它定义：

```text
DailyRecord
DailyRecordSide
ExchangeRecord
ExchangeCategory
Wallet
ResourceKind
HeatmapDay
HeatLevel
ExerciseTag
CoinRulesConfig
SettlementVisualRules
UserRuntimeData
AppConfigData
AppDataSnapshot
```

这些类型构成当前项目的数据模型基础。

## 7.2 架构原则

所有跨模块共享的数据结构应放在类型层。

组件中不要临时定义与业务对象重复的类型。

如果某个对象未来需要进入数据库，应优先在 `types.ts` 中有明确模型。

---

# 8. 规则计算层：`settlement-rules.ts`

## 8.1 文件位置

```text
lib/home/settlement-rules.ts
```

## 8.2 职责

该文件负责每日结算规则计算，包括：

```text
宝石上限
体重解析
热量缺口宝石
运动宝石
恢复奖励
双人 bonus
热力图等级
运动角标
金币预览
日期辅助函数
```

当前规则中包括 `GEM_CAP`、默认金币规则、默认热力图视觉规则、热量缺口宝石、运动宝石、恢复奖励、双人 bonus 和金币预览计算。

金币预览逻辑会根据周宝石阈值、连续打卡和本周一起运动次数计算金币变化。

## 8.3 架构原则

规则计算必须尽量保持纯函数。

它应该：

```text
输入明确
输出明确
不依赖 React
不访问 localStorage
不修改外部状态
不关心 UI 展示
```

示例：

```text
输入：fishInput、catInput、dailyRecords、coinRules
输出：宝石、金币、bonus、提示信息
```

不应：

```text
打开弹窗
显示 toast
写入 state
写入 localStorage
```

---

# 9. 统计计算层：`home-stat-service.ts`

## 9.1 文件位置

```text
lib/home/home-stat-service.ts
```

## 9.2 职责

该层负责从已有记录中计算统计结果。

它适合承担：

```text
钱包余额回算
本周宝石
本周金币
连续天数
累计成功天数
今日记录
昨日记录
金币规则重算
```

`daily-record-service.ts` 中已经调用 `computeGemWallet`、`countSuccessfulCheckInsInWeek`、`countSuccessfulCheckInsTotal`、`recalculateCoinsWithCurrentRules`、`sumRecordGemsInCoinWeek` 等统计函数。

## 9.3 架构原则

统计层也应保持纯函数。

它不负责：

```text
UI 展示
弹窗状态
输入框状态
本地存储读写
```

它只根据记录和规则返回计算结果。

---

# 10. 每日记录服务层：`daily-record-service.ts`

## 10.1 文件位置

```text
lib/home/daily-record-service.ts
```

## 10.2 职责

该服务层负责每日记录的创建、更新、补录、删除，以及相关派生状态重建。

当前文件中包含：

```text
createTodayDailyRecord
applyTodayRecordToState
upsertDailyRecordInState
updateDailyRecordInState
deleteDailyRecordFromState
```

它会在构建记录时调用宝石、金币、bonus、热力图规则，并在记录变更后重建派生状态。

## 10.3 系统行为

每日记录保存时，该层负责：

```text
校验日期
判断是否已有记录
构建 DailyRecord
计算鱼鱼宝石
计算猫猫宝石
计算情侣 bonus
计算金币变化
生成热力图状态
回算钱包
重建本周统计
重建连续统计
重建热力图 overrides
```

`buildDailyRecordForDate` 会根据输入、已有记录、前一天记录、金币规则和视觉规则生成完整 `DailyRecord`。

## 10.4 架构原则

每日记录服务层负责业务状态变更，不负责 UI。

它可以：

```text
接收 HomeResourcesState
返回新的 HomeResourcesState
调用 settlement-rules
调用 home-stat-service
处理日期校验
处理记录去重
```

不应：

```text
直接操作 React state
直接显示 toast
直接打开弹窗
直接访问 DOM
直接访问 localStorage
```

---

# 11. 兑换服务层：`exchange-service.ts`

## 11.1 文件位置

```text
lib/home/exchange-service.ts
```

## 11.2 职责

兑换服务层负责兑换相关数据处理。

它适合承担：

```text
创建兑换记录
规范化兑换记录
排序兑换记录
新增/编辑奖励类别
删除奖励类别
规范化奖励类别
```

`HomeResourcesProvider` 中通过 `createExchangeRecordFromPayload`、`normalizeExchangeRecord`、`orderExchangeRecords`、`upsertExchangeCategoryInList`、`deleteExchangeCategoryFromList` 等函数处理兑换相关数据。

## 11.3 架构原则

兑换服务层只处理兑换业务数据，不处理 UI。

它不应：

```text
控制弹窗
显示 toast
决定按钮样式
访问 localStorage
```

---

# 12. 状态恢复层：`home-state-service.ts`

## 12.1 文件位置

```text
lib/home/home-state-service.ts
```

## 12.2 职责

该层负责创建默认状态、读取状态、恢复状态、归一化状态和写回状态。

当前它包含：

```text
createDefaultHomeResourcesState
readHomeResourcesState
writeHomeResourcesState
```

默认状态中包含钱包、连续天数、热力图起始日、金币规则、视觉规则、每日记录、兑换记录和默认奖励分类。

读取状态时，它会从 Store 加载快照，处理缺失数据、归一化每日记录、归一化兑换记录、归一化兑换类别，并重新计算金币相关数据。

## 12.3 架构原则

状态恢复层负责：

```text
默认状态
兼容旧数据
兜底异常数据
数据归一化
初始化回算
```

不负责：

```text
UI 展示
组件交互
用户点击行为
弹窗逻辑
```

---

# 13. 存储抽象层：`app-data-store.ts`

## 13.1 文件位置

```text
lib/home/app-data-store.ts
```

## 13.2 职责

该文件定义应用数据存储接口和快照转换逻辑。

核心接口：

```ts
type AppDataStore = {
  load: () => AppDataSnapshot | null;
  save: (snapshot: AppDataSnapshot) => void;
  clear?: () => void;
};
```

同时它定义了存储 key、快照校验、从 HomeResourcesState 生成 AppDataSnapshot，以及从快照恢复 state patch 的函数。

## 13.3 架构意义

这是未来替换数据来源的关键抽象。

当前数据来源是 localStorage；未来可以替换成：

```text
REST API
GraphQL API
IndexedDB
云端数据库
小程序 storage
App 本地存储
```

只要实现同样的 `AppDataStore` 接口，上层 Provider 和 UI 不应大改。

---

# 14. 本地存储实现层：`local-storage-app-data-store.ts`

## 14.1 文件位置

```text
lib/home/local-storage-app-data-store.ts
```

## 14.2 职责

该文件是 `AppDataStore` 的 localStorage 实现。

它负责：

```text
从 localStorage 读取快照
写入 localStorage
清空 localStorage
兼容旧格式数据
在服务端环境下返回 null 或跳过操作
```

代码中通过 `typeof window === "undefined"` 避免服务端访问浏览器 API。

## 14.3 架构原则

UI 不直接访问 localStorage。
只有 Store 实现可以访问 localStorage。

---

# 15. 默认配置层：`home-default-config.ts`

## 15.1 文件位置

```text
lib/home/home-default-config.ts
```

## 15.2 职责

该文件负责程序内置的默认兑换类别。

当前默认奖励类别包括零食、双份零食、双份饮料、大餐、豪华大餐、家庭放纵餐，每个类别包含 id、标题、图标、说明、资源类型和价格。

## 15.3 架构原则

默认配置是程序启动时的基础数据。

用户修改后的配置应进入 `exchangeCategories`，而不是直接修改默认配置文件。

---

# 16. 测试层：`tests/home/`

## 16.1 职责

测试层用于验证业务规则和服务层行为。

适合测试：

```text
宝石计算
金币计算
每日记录新增/更新/删除
钱包回算
兑换记录创建
状态恢复
数据归一化
导入导出
```

当前项目 package 中包含 Vitest 测试脚本。

## 16.2 架构原则

优先测试纯函数和 service。

不建议优先测试复杂 UI 样式。

---

# 17. 当前依赖关系

## 17.1 推荐依赖方向

```text
UI Components
  ↓
HomeResourcesProvider
  ↓
Service Layer
  ↓
Rules / Stat Pure Functions
  ↓
Types
  ↓
Store Abstraction
```

更具体地说：

```text
components/home/*
  → useHomeResources()

HomeResourcesProvider
  → home-state-service
  → daily-record-service
  → exchange-service
  → local-storage-app-data-store

daily-record-service
  → settlement-rules
  → home-stat-service
  → daily-record-utils
  → date-utils

home-state-service
  → app-data-store
  → exchange-service
  → home-stat-service
  → settlement-rules

local-storage-app-data-store
  → app-data-store
```

## 17.2 禁止反向依赖

不应出现：

```text
lib/home 依赖 components
service 依赖 React
rules 依赖 Provider
store 依赖 UI
types 依赖组件
```

---

# 18. 架构原则

## 18.1 UI 不直接访问 localStorage

错误：

```text
组件中直接 window.localStorage.getItem
组件中直接 window.localStorage.setItem
```

正确：

```text
组件调用 Provider action
Provider 调用 State Service
State Service 调用 AppDataStore
Store 实现决定数据来源
```

当前架构已经通过 `AppDataStore` 和 `createLocalStorageAppDataStore` 实现了存储抽象。

---

## 18.2 UI 不直接计算宝石金币

错误：

```text
组件里写 gemsFromDeficit
组件里写金币触发规则
组件里写连续天数计算
```

正确：

```text
UI 收集输入
调用 Provider action
Provider 调用 service
service 调用 settlement-rules / stat-service
```

宝石、金币、bonus、热力图等级等计算应放在 `settlement-rules.ts` 和统计服务中。

---

## 18.3 业务规则保持纯函数

规则函数应满足：

```text
相同输入得到相同输出
不修改外部状态
不依赖 UI
不访问浏览器 API
不写入存储
```

适合放在：

```text
lib/home/settlement-rules.ts
lib/home/home-stat-service.ts
```

---

## 18.4 Provider 只做状态编排

Provider 不应变成业务规则大杂烩。

它的职责是：

```text
持有 state
调用 service
提交 state
暴露 action
同步 Store
```

---

## 18.5 Service 负责业务状态变更

Service 接收旧状态，返回新状态。

例如每日记录服务负责新增、编辑、删除记录并回算派生数据。

---

## 18.6 Store 负责数据来源

当前 Store 是 localStorage。未来换成后端 API 时，应优先替换 Store 层，而不是改所有 UI。

理想替换路径：

```text
createLocalStorageAppDataStore()
  ↓
createRemoteAppDataStore()
```

上层尽量不变。

---

# 19. 文件放置规则

## 19.1 新 UI 组件放哪里

放在：

```text
components/home/
```

适合：

```text
GrowthLogDetail
RewardSummaryCard
CompactField
ExchangeRecordCard
```

如果组件只服务某个页面，可以放在同文件内部。
如果多个组件复用，再抽独立文件。

---

## 19.2 新业务规则放哪里

放在：

```text
lib/home/settlement-rules.ts
```

适合：

```text
新的宝石规则
新的金币规则
新的 bonus 规则
新的热力图阈值规则
```

---

## 19.3 新统计函数放哪里

放在：

```text
lib/home/home-stat-service.ts
```

适合：

```text
周统计
月统计
连续天数
钱包回算
周报数据
月报数据
```

---

## 19.4 每日记录增删改放哪里

放在：

```text
lib/home/daily-record-service.ts
```

适合：

```text
新增记录
更新记录
删除记录
补录记录
记录去重
记录回算
```

---

## 19.5 兑换相关逻辑放哪里

放在：

```text
lib/home/exchange-service.ts
```

适合：

```text
创建兑换记录
排序兑换记录
编辑兑换记录
奖励分类增删改
兑换记录归一化
```

---

## 19.6 存储逻辑放哪里

抽象接口放：

```text
lib/home/app-data-store.ts
```

具体实现放：

```text
lib/home/local-storage-app-data-store.ts
```

未来 API 实现可新增：

```text
lib/home/remote-app-data-store.ts
```

---

## 19.7 类型定义放哪里

放在：

```text
lib/home/types.ts
```

原则：

```text
跨多个模块共享的类型放 types.ts
组件内部临时类型放组件内部
```

---

## 19.8 测试放哪里

放在：

```text
tests/home/
```

优先测试：

```text
settlement-rules
home-stat-service
daily-record-service
exchange-service
home-state-service
```

---

# 20. 未来后端迁移架构

## 20.1 当前阶段

```text
UI → Provider → Service → localStorage Store
```

## 20.2 后端阶段目标

```text
UI → Provider → Service → Remote AppDataStore → API → Database
```

## 20.3 优先替换点

未来替换 API 时，优先替换：

```text
AppDataStore
```

不要让 UI 直接调用 API。

## 20.4 可能的新模块

```text
lib/home/remote-app-data-store.ts
lib/home/api-client.ts
app/api/*
database schema
auth provider
```

## 20.5 后端迁移原则

* UI 层不感知数据来自 localStorage 还是 API；
* Provider 暴露的 action 尽量保持不变；
* service 层规则尽量复用；
* 纯计算函数不依赖后端；
* 数据模型以 `types.ts` 为基础演进。

---

# 21. Hydration 与客户端边界原则

当前项目是 Next.js 应用，需要注意服务端和客户端首屏一致性。

## 21.1 避免在首屏 render 中使用

```text
new Date()
Date.now()
Math.random()
window
localStorage
浏览器尺寸
随机文案
```

## 21.2 推荐做法

* 浏览器 API 放在 Store 实现或 `useEffect` 中；
* 首屏使用稳定 fallback；
* 客户端挂载后再计算依赖当前时间的数据；
* 随机文案不要参与 SSR 首屏。

本地存储实现中已经通过 `typeof window === "undefined"` 避免服务端访问 localStorage。

---

# 22. 当前架构的优点

当前架构已经具备几个好的基础：

1. **类型集中** ：核心模型集中在 `lib/home/types.ts`。
2. **规则抽离** ：宝石、金币、热力图规则在 `settlement-rules.ts`。
3. **服务分层** ：每日记录和兑换逻辑拆到 service。
4. **存储抽象** ：`AppDataStore` 已经抽象 load/save/clear。
5. **状态编排集中** ：`HomeResourcesProvider` 提供统一 Context。
6. **未来可迁移** ：localStorage 可以替换为远程 Store。

---

# 23. 当前架构需要注意的问题

## 23.1 Provider 可能继续变重

随着功能增加，Provider 容易承担太多职责。
后续应避免把复杂逻辑继续写入 Provider。

## 23.2 UI 组件可能继续变大

例如 `GrowthLog`、`ExchangeShop`、`RecordTodaySettlement` 容易膨胀。

后续可以拆：

```text
GrowthLogList
GrowthLogDetailDialog
GrowthLogEditDialog
ExchangeBrowsePanel
ExchangeRecordDialog
CompactField
```

## 23.3 派生数据要避免多处重复计算

宝石、金币、热力图、钱包等派生数据应集中在 service/rules/stat 中计算。

## 23.4 旧 CSS 需要及时清理

UI 反复调整时容易留下旧 class。
每次替换结构后，应删除旧样式，避免冲突。

---

# 24. 总结

当前项目架构可以概括为：

```text
app 负责入口
components 负责 UI
HomeResourcesProvider 负责状态编排
lib/home/types 负责数据模型
settlement-rules 负责奖励规则
home-stat-service 负责统计计算
daily-record-service 负责每日记录状态变更
exchange-service 负责兑换业务
home-state-service 负责状态恢复
app-data-store 负责存储抽象
local-storage-app-data-store 负责本地存储实现
tests/home 负责业务测试
```

最重要的架构原则：

```text
UI 不直接访问 localStorage
UI 不直接计算宝石金币
业务规则保持纯函数
Provider 只做状态编排
Service 负责状态变更
Store 负责数据来源
未来替换 API 时优先替换 AppDataStore
```

这个架构的目标是：
**让 UI 可以持续调整，让业务规则可以独立测试，让数据来源未来可以从 localStorage 平滑迁移到后端。**
