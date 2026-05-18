
# 数据分类文档：双人变美变瘦大作战

# 1. 文档目的

本文档用于梳理项目中的数据类型，明确哪些数据是程序内置、哪些由用户产生、哪些属于配置、哪些可以导出备份、哪些是派生计算结果、哪些只是临时 UI 状态。

这份文档的核心作用是帮助后续判断：

```text
哪些数据要进数据库？
哪些数据只保存在前端？
哪些数据可以导出？
哪些数据不该持久化？
哪些数据应该重新计算，而不是保存？
```

---

# 2. 数据分类总览

项目数据可以分为六类：

```text
1. 程序内置数据
2. 用户业务记录数据
3. 用户个性化配置数据
4. 可导出 / 备份数据
5. 派生计算数据
6. 临时 UI 状态
```

其中最重要的区分是：

```text
用户产生的数据和用户配置，需要持久化；
派生计算数据，优先通过记录重新计算；
临时 UI 状态，不应该持久化。
```

---

# 3. 程序内置数据

## 3.1 定义

程序内置数据是产品启动时自带的默认规则、默认配置和默认选项。
它们不是用户行为产生的，而是应用本身提供的初始规则。

## 3.2 当前包含

### 3.2.1 默认角色

当前项目中有两个固定角色：

```text
fish
cat
```

它们用于区分两个人的每日记录、热力图和宝石计算。

相关类型中 `PersonKey` 定义为 `fish | cat`。

---

### 3.2.2 默认宝石规则

程序内置了宝石计算规则，包括：

```text
鱼鱼热量缺口规则
猫猫热量缺口规则
运动宝石规则
恢复日奖励规则
双人 bonus 规则
```

例如鱼鱼和猫猫的热量缺口阈值不同，运动宝石和恢复奖励也由内置规则计算。

---

### 3.2.3 默认金币规则

当前默认金币规则包括：

```text
weekStartDay
deficitStreakDays
```

默认配置中，金币规则包含周起始日和连续打卡天数。

---

### 3.2.4 默认热力图视觉规则

默认视觉规则包括：

```text
鱼鱼热力图阈值
猫猫热力图阈值
运动角标阈值
```

系统中热力图等级包括 `none / ok / good / perfect`，运动角标包括 `none / run / intense`。

---

### 3.2.5 默认奖励分类

项目内置了一组默认兑换奖励，例如：

```text
零食
双份零食
双份饮料
大餐
豪华大餐
家庭放纵餐
```

每个奖励分类包含名称、图标、说明、资源类型和价格。

---

## 3.3 是否持久化

程序内置数据本身不一定需要作为用户数据持久化。

但如果用户修改了默认规则或默认奖励分类，那么修改后的版本就变成  **用户个性化配置数据** ，需要持久化。

---

# 4. 用户业务记录数据

## 4.1 定义

用户业务记录数据是用户在使用过程中主动产生的核心数据。
它们是项目最重要的数据资产，必须持久化，也应该支持未来导出和备份。

---

## 4.2 每日记录 DailyRecord

每日记录是项目的核心业务数据。

一条每日记录包括：

```text
id
date
recordDate
createdAt
day
fish
cat
bonus
coins
fishHeat
catHeat
```

其中 fish 和 cat 各自包含：

```text
weightKg
deficit
minutes
gems
```

类型定义中 `DailyRecord` 已明确包含这些字段。

---

## 4.3 每日记录中的用户原始输入

这些字段是用户真实输入，应当持久化：

```text
fish.weightKg
fish.deficit
fish.minutes
cat.weightKg
cat.deficit
cat.minutes
recordDate
createdAt
```

这些是后续重新计算宝石、金币、热力图和统计数据的基础。

---

## 4.4 每日记录中的结果字段

这些字段目前存储在每日记录中，但本质上可以由原始输入和规则重新计算：

```text
fish.gems
cat.gems
bonus
coins
fishHeat
catHeat
```

当前项目中它们作为每日记录的一部分保存。

长期建议：

```text
MVP 阶段：可以持久化，方便展示和调试；
后端阶段：应考虑保留原始输入 + 规则版本，通过服务端回算或快照保存。
```

---

## 4.5 兑换记录 ExchangeRecord

兑换记录是用户兑换奖励后产生的业务数据。

一条兑换记录包括：

```text
id
date
createdAt
occurredAt
time
category
remark
resourceKind
price
icon
```

类型定义中 `ExchangeRecord` 已包含这些字段。

---

## 4.6 兑换记录中的用户输入

应持久化：

```text
occurredAt
remark
category
resourceKind
price
icon
```

其中：

* `remark` 是用户备注；
* `occurredAt` 是兑换发生时间；
* `category / price / resourceKind / icon` 用于保留兑换当时快照，避免未来奖励分类修改后影响历史记录。

---

## 4.7 是否可导出

用户业务记录数据必须支持未来导出。

包括：

```text
dailyRecords
exchangeRecords
```

---

# 5. 用户个性化配置数据

## 5.1 定义

用户个性化配置数据是用户修改后的偏好、规则和自定义内容。
它不一定每天变化，但应持久化，并在未来支持导出备份。

---

## 5.2 热力图起始日

字段：

```text
heatmapStartDate
```

作用：

```text
决定成长地图从哪一天开始排列
影响作战第几天计算
影响热力图显示
```

该字段在全局状态中存在。

应持久化。

---

## 5.3 金币规则配置

字段：

```text
coinRules
```

包括：

```text
weekStartDay
deficitStreakDays
```

这些属于可配置规则。当前全局状态中包含 `coinRules`。

应持久化。

---

## 5.4 热力图视觉规则

字段：

```text
visualRules
```

包括：

```text
fish 热力图阈值
cat 热力图阈值
运动角标阈值
```

当前全局状态中包含 `visualRules`。

应持久化，尤其当未来支持自定义规则时。

---

## 5.5 自定义奖励分类

字段：

```text
exchangeCategories
```

每个奖励分类包括：

```text
id
title
icon
description
resourceKind
price
```

类型定义中 `ExchangeCategory` 已包含这些字段。

如果用户新增、编辑、删除奖励类别，需要持久化。

---

## 5.6 未来可能增加的个性化配置

未来可考虑：

```text
角色昵称
角色头像 / emoji
主题色
首页模块显示顺序
默认记录单位
提醒偏好
数据备份偏好
```

这些都应归入用户个性化配置。

---

# 6. 可导出 / 备份数据

## 6.1 定义

可导出数据是用户换设备、备份、迁移时需要保留的数据。

原则：

```text
只导出能恢复用户使用状态的数据；
不导出纯 UI 临时状态；
派生数据可选择导出，但应能重算。
```

---

## 6.2 当前建议导出内容

建议导出：

```text
dailyRecords
exchangeRecords
exchangeCategories
heatmapStartDate
coinRules
visualRules
wallet，可选
streakDays，可选
weeklySuccessDays，可选
cumulativeSuccessDays，可选
```

当前项目的数据快照本身已经区分 runtime 和 config 两部分：`UserRuntimeData` 与 `AppConfigData`。

---

## 6.3 必须导出的数据

```text
dailyRecords
exchangeRecords
exchangeCategories
heatmapStartDate
coinRules
visualRules
```

原因：

* 每日记录是核心历史；
* 兑换记录是核心消费历史；
* 奖励分类是用户自定义内容；
* 起始日和规则会影响历史解释。

---

## 6.4 可选导出的数据

```text
wallet
weekGemTotal
weekCoinTotal
streakDays
weeklySuccessDays
cumulativeSuccessDays
yesterdayGemTotal
todayFishGems
todayCatGems
todayBonusGems
```

这些属于运行状态或派生统计。
导出时可以包含快照，但导入后应允许重新计算。

---

## 6.5 不建议导出的数据

```text
弹窗打开状态
当前 tab
toast 文案
输入框未保存内容
动画进入状态
hover 状态
当前临时选择的 overlay
```

这些属于临时 UI 状态，不应导出。

---

# 7. 派生计算数据

## 7.1 定义

派生计算数据是可以由用户业务记录、规则和配置重新计算出来的数据。

它们可以用于展示，也可以为了性能暂存，但不应被视为唯一事实来源。

---

## 7.2 钱包余额

字段：

```text
wallet.gems
wallet.coins
```

当前全局状态中保存了钱包。

从数据建模角度看：

```text
宝石余额 = 每日记录产生的宝石 - 宝石兑换消耗
金币余额 = 每日记录产生的金币 - 金币兑换消耗
```

当前项目中，兑换时会根据每日记录和兑换记录计算宝石钱包。

建议：

```text
MVP 阶段可以持久化 wallet；
后端阶段应支持通过 dailyRecords + exchangeRecords 回算 wallet。
```

---

## 7.3 本周统计

字段：

```text
weekGemTotal
weekCoinTotal
weeklySuccessDays
```

这些可以由每日记录和当前日期 / 周规则计算。

建议：

```text
可以保存快照；
但展示前应允许重新计算。
```

---

## 7.4 连续统计

字段：

```text
streakDays
cumulativeSuccessDays
```

这些属于统计结果，可以由 `dailyRecords` 和规则计算。

---

## 7.5 今日统计

字段：

```text
todayFishGems
todayCatGems
todayBonusGems
yesterdayGemTotal
```

这些可以由日期和每日记录计算。

---

## 7.6 热力图结果

字段：

```text
fishHeat
catHeat
```

每日记录中包含热力图结果。

它们本质上由：

```text
deficit
minutes
visualRules
```

计算得出。

建议：

```text
MVP 阶段可以持久化；
未来如规则可配置，应考虑保留规则版本或在规则变化后重算。
```

---

## 7.7 宝石 / 金币明细

例如：

```text
缺口 +2
运动 +1
恢复 +1
情侣 bonus +2
金币触发说明
```

这些不应作为长期独立数据保存，而应在详情页根据记录和规则临时计算。

---

# 8. 临时 UI 状态

## 8.1 定义

临时 UI 状态只用于控制当前界面交互，不代表用户业务数据。

这些数据不应该写入数据库，也不应该导出。

---

## 8.2 当前项目中的临时 UI 状态示例

### 弹窗状态

```text
open
overlay
sheetEnter
overlayEnter
confirmDeleteOpen
```

用于控制弹窗显示、动画和层级。

---

### 表单临时输入

```text
fishW
fishD
fishM
catW
catD
catM
recordForm
categoryForm
```

这些只在保存前临时存在。保存后才会转化为业务记录或配置。

---

### toast 状态

```text
toast
```

只用于短暂提示，不应持久化。

---

### 当前查看状态

```text
viewMonth
viewMonthDate
mode
detailMode
selectedRecordId
editingRecordId
```

这些用于控制用户当前正在看什么，不属于长期数据。

---

### 动画状态

```text
entered
sheetEnter
overlayEnter
```

只用于动画进入 / 退出，不应持久化。

---

## 8.3 是否可导出

临时 UI 状态不导出。

---

## 8.4 是否进数据库

临时 UI 状态不进数据库。

---

# 9. 数据持久化建议

## 9.1 当前 MVP 阶段

当前可以持久化：

```text
dailyRecords
exchangeRecords
exchangeCategories
heatmapStartDate
coinRules
visualRules
wallet
统计字段快照
```

当前项目已经通过本地存储读取和写入 HomeResourcesState。状态初始化时会创建默认数据，并尝试从本地读取快照。

---

## 9.2 后端阶段建议

如果未来接入数据库，建议拆为：

### 用户表

```text
user
partnerBinding
profile
```

### 每日记录表

```text
daily_records
```

保存：

```text
recordDate
fishWeightKg
fishDeficit
fishMinutes
catWeightKg
catDeficit
catMinutes
createdAt
updatedAt
```

### 兑换记录表

```text
exchange_records
```

保存：

```text
occurredAt
categorySnapshot
resourceKind
price
remark
createdAt
updatedAt
```

### 用户配置表

```text
user_config
```

保存：

```text
heatmapStartDate
coinRules
visualRules
theme
roleNames
```

### 奖励分类表

```text
exchange_categories
```

保存用户自定义奖励分类。

---

# 10. 不应持久化的数据

以下数据不应进入数据库：

```text
弹窗是否打开
当前弹窗模式
输入框未保存草稿
toast 文案
动画 entered 状态
hover 状态
当前 tab
当前查看月份，除非明确作为用户偏好
临时预览结果
临时计算出的奖励明细
```

其中，当前查看月份一般不需要持久化；如果未来产品希望记住用户上次查看位置，可以作为 UI 偏好单独存储，但不属于核心业务数据。

---

# 11. 数据导入导出建议

## 11.1 导出格式建议

导出数据可分为：

```text
runtime
config
metadata
```

示例结构：

```json
{
  "version": 1,
  "metadata": {
    "exportedAt": "2026-05-15T00:00:00.000Z"
  },
  "runtime": {
    "dailyRecords": [],
    "exchangeRecords": []
  },
  "config": {
    "heatmapStartDate": "",
    "coinRules": {},
    "visualRules": {},
    "exchangeCategories": []
  }
}
```

当前项目中已有类似的 `runtime` 和 `config` 数据分类设计。

---

## 11.2 导入原则

导入时应：

```text
校验 version
校验 dailyRecords
校验 exchangeRecords
校验配置字段
归一化旧数据
避免重复记录
必要时重新计算派生数据
```

---

# 12. 数据分类表

| 数据           | 类型            | 是否持久化 | 是否导出 | 是否可重算 | 说明               |
| -------------- | --------------- | ---------: | -------: | ---------: | ------------------ |
| 默认宝石规则   | 程序内置        |         否 |       否 |         否 | 程序默认规则       |
| 默认金币规则   | 程序内置 / 配置 |         是 |       是 |         否 | 用户未来可配置     |
| 默认奖励分类   | 程序内置        |         否 |       否 |         否 | 初始数据           |
| 自定义奖励分类 | 用户配置        |         是 |       是 |         否 | 用户修改后需保存   |
| 每日记录       | 用户业务记录    |         是 |       是 |         否 | 核心事实数据       |
| 体重           | 用户业务记录    |         是 |       是 |         否 | 每日记录的一部分   |
| 热量缺口       | 用户业务记录    |         是 |       是 |         否 | 每日记录的一部分   |
| 运动分钟       | 用户业务记录    |         是 |       是 |         否 | 每日记录的一部分   |
| 兑换记录       | 用户业务记录    |         是 |       是 |         否 | 核心历史           |
| 兑换备注       | 用户业务记录    |         是 |       是 |         否 | 用户输入           |
| 热力图起始日   | 用户配置        |         是 |       是 |         否 | 影响展示           |
| 视觉规则       | 用户配置        |         是 |       是 |         否 | 影响热力图         |
| 钱包余额       | 派生 / 快照     |   可持久化 |   可导出 |         是 | 可由记录回算       |
| 本周宝石       | 派生            |   可持久化 |     可选 |         是 | 统计展示           |
| 本周金币       | 派生            |   可持久化 |     可选 |         是 | 统计展示           |
| 连续天数       | 派生            |   可持久化 |     可选 |         是 | 统计展示           |
| 热力图结果     | 派生 / 快照     |   可持久化 |     可选 |         是 | 可由规则重算       |
| 宝石明细       | 派生            |         否 |       否 |         是 | 详情页临时展示     |
| 金币提示       | 派生            |         否 |       否 |         是 | 详情页临时展示     |
| 弹窗开关       | 临时 UI         |         否 |       否 |         否 | 不进数据库         |
| toast          | 临时 UI         |         否 |       否 |         否 | 不进数据库         |
| 输入草稿       | 临时 UI         |         否 |       否 |         否 | 保存后才转业务数据 |
| 当前 tab       | 临时 UI         |         否 |       否 |         否 | 不属于业务数据     |
| 动画状态       | 临时 UI         |         否 |       否 |         否 | 不持久化           |

---

# 13. 核心结论

项目的数据设计应遵守：

```text
用户输入是事实数据；
规则和配置决定如何解释事实数据；
统计和奖励是派生结果；
UI 状态只是临时表现。
```

最重要的数据是：

```text
dailyRecords
exchangeRecords
exchangeCategories
heatmapStartDate
coinRules
visualRules
```

未来接入后端时，应优先持久化这些数据。
钱包、周统计、连续天数、热力图结果可以保存快照，但必须允许重新计算。
弹窗、toast、输入草稿、当前 tab、动画状态不应进入数据库。
# 当前实现同步说明（2026-05）

当前可导出 / 可备份数据包括：`wallet`、`dailyRecords`、`exchangeRecords`、`exchangeCategories`、`heatmapStartDate`、`coinRules`、`visualRules`。完整备份 JSON 使用 `schemaVersion: 1`，导入方式为覆盖导入。

`wallet` 是可导出的快照，但宝石余额应能从 `dailyRecords + exchangeRecords` 按业务日期回放重算。`exchangeRecords` 是历史事实数据，必须保留兑换当时的 `category`、`icon`、`resourceKind`、`price`、`remark` 快照。
