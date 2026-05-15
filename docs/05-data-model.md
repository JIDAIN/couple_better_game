
# 数据模型文档：双人变美变瘦大作战

# 1. 文档目的

本文档用于说明系统中的核心数据对象、字段结构、对象关系、数据来源、是否可导出、是否适合未来进入数据库。

它帮助判断：

```text
哪些对象是核心业务数据？
哪些对象只是配置？
哪些对象可以计算得出？
哪些对象未来需要进数据库？
哪些对象只存在于前端 UI 状态？
```

---

# 2. 核心数据对象总览

当前项目核心对象可以分为：

```text
1. 应用快照对象
   - AppDataSnapshot
   - UserRuntimeData
   - AppConfigData

2. 用户业务对象
   - DailyRecord
   - DailyRecordSide
   - ExchangeRecord

3. 配置对象
   - ExchangeCategory
   - CoinRulesConfig
   - SettlementVisualRules
   - HeatmapThresholds
   - ExerciseTagThresholds

4. 钱包与资源对象
   - Wallet
   - ResourceKind

5. 热力图对象
   - HeatmapDay
   - HeatLevel
   - ExerciseTag
   - HeatmapDayOverrides

6. 未来扩展对象
   - CoupleSpace
   - PartnerProfile
   - WalletLedger
```

当前项目中，`types.ts` 已经定义了多数核心类型，例如 `DailyRecord`、`ExchangeRecord`、`ExchangeCategory`、`Wallet`、`UserRuntimeData`、`AppConfigData`、`AppDataSnapshot` 等。

---

# 3. AppDataSnapshot

## 3.1 对象说明

`AppDataSnapshot` 表示整个应用可保存、可导入导出的数据快照。

它是本地存储和未来数据备份的顶层结构。

## 3.2 TypeScript 模型

```ts
type AppDataSnapshot = {
  version: 1;
  runtime: Partial<UserRuntimeData>;
  config: Partial<AppConfigData>;
};
```

## 3.3 字段说明

| 字段    | 类型    | 必填 | 来源     | 是否可导出 | 未来是否进数据库 | 说明         |
| ------- | ------- | ---: | -------- | ---------: | ---------------: | ------------ |
| version | number  |   是 | 系统生成 |         是 |             可选 | 数据快照版本 |
| runtime | Partial |   是 | 用户行为 |         是 |               是 | 用户运行数据 |
| config  | Partial |   是 | 用户配置 |         是 |               是 | 应用配置数据 |

## 3.4 关系说明

```text
AppDataSnapshot
  ├── runtime: UserRuntimeData
  └── config: AppConfigData
```

---

# 4. UserRuntimeData

## 4.1 对象说明

`UserRuntimeData` 表示用户在使用过程中产生或变化的数据。

它包含每日记录、兑换记录、钱包、连续天数和统计数据。

## 4.2 TypeScript 模型

```ts
type UserRuntimeData = {
  wallet: Wallet;
  streakDays: number;
  weeklySuccessDays: number;
  cumulativeSuccessDays: number;
  yesterdayGemTotal: number;
  todayFishGems: number;
  todayCatGems: number;
  todayBonusGems: number;
  weekGemTotal: number;
  weekCoinTotal: number;
  fishHeatmapOverrides: HeatmapDayOverrides;
  catHeatmapOverrides: HeatmapDayOverrides;
  dailyRecords: DailyRecord[];
  exchangeRecords: ExchangeRecord[];
};
```

## 4.3 字段说明

| 字段                  | 类型                | 必填 | 来源         | 是否可导出 | 未来是否进数据库 | 说明               |
| --------------------- | ------------------- | ---: | ------------ | ---------: | ---------------: | ------------------ |
| wallet                | Wallet              |   是 | 派生/快照    |     可导出 |             可选 | 当前宝石和金币余额 |
| streakDays            | number              |   是 | 派生计算     |       可选 |             可选 | 连续坚持天数       |
| weeklySuccessDays     | number              |   是 | 派生计算     |       可选 |             可选 | 本周坚持天数       |
| cumulativeSuccessDays | number              |   是 | 派生计算     |       可选 |             可选 | 累计成功天数       |
| yesterdayGemTotal     | number              |   是 | 派生计算     |       可选 |             可选 | 昨日宝石总数       |
| todayFishGems         | number              |   是 | 派生计算     |       可选 |             可选 | 鱼鱼今日宝石       |
| todayCatGems          | number              |   是 | 派生计算     |       可选 |             可选 | 猫猫今日宝石       |
| todayBonusGems        | number              |   是 | 派生计算     |       可选 |             可选 | 今日双人 bonus     |
| weekGemTotal          | number              |   是 | 派生计算     |       可选 |             可选 | 本周宝石           |
| weekCoinTotal         | number              |   是 | 派生计算     |       可选 |             可选 | 本周金币           |
| fishHeatmapOverrides  | HeatmapDayOverrides |   是 | 用户/系统    |       可选 |             可选 | 鱼鱼热力图覆盖数据 |
| catHeatmapOverrides   | HeatmapDayOverrides |   是 | 用户/系统    |       可选 |             可选 | 猫猫热力图覆盖数据 |
| dailyRecords          | DailyRecord[]       |   是 | 用户业务记录 |         是 |               是 | 每日记录           |
| exchangeRecords       | ExchangeRecord[]    |   是 | 用户业务记录 |         是 |               是 | 兑换记录           |

## 4.4 建模建议

`dailyRecords` 和 `exchangeRecords` 是真正的事实数据，未来必须进数据库。

`wallet`、`weekGemTotal`、`streakDays` 等是统计快照，可以保存，但不应作为唯一真相来源。未来后端阶段建议可由 `dailyRecords + exchangeRecords + rules` 回算。

---

# 5. AppConfigData

## 5.1 对象说明

`AppConfigData` 表示应用配置数据，包括热力图起始日、金币规则、视觉规则和奖励分类。

## 5.2 TypeScript 模型

```ts
type AppConfigData = {
  heatmapStartDate: string;
  coinRules: CoinRulesConfig;
  visualRules: SettlementVisualRules;
  exchangeCategories: ExchangeCategory[];
};
```

## 5.3 字段说明

| 字段               | 类型                  | 必填 | 来源          | 是否可导出 | 未来是否进数据库 | 说明              |
| ------------------ | --------------------- | ---: | ------------- | ---------: | ---------------: | ----------------- |
| heatmapStartDate   | string                |   是 | 用户配置      |         是 |               是 | 作战/热力图起始日 |
| coinRules          | CoinRulesConfig       |   是 | 内置/用户配置 |         是 |               是 | 金币规则          |
| visualRules        | SettlementVisualRules |   是 | 内置/用户配置 |         是 |               是 | 热力图视觉阈值    |
| exchangeCategories | ExchangeCategory[]    |   是 | 内置/用户配置 |         是 |               是 | 兑换奖励分类      |

## 5.4 建模建议

配置数据应长期可导出、可备份。未来如果支持用户自定义规则，这部分应进入数据库。

---

# 6. DailyRecord

## 6.1 对象说明

`DailyRecord` 表示某一天的完整成长记录。

它是项目最核心的业务对象之一。

一条 `DailyRecord` 代表某一天鱼鱼和猫猫各自的输入数据、奖励结果、双人 bonus、金币变化和热力图状态。

## 6.2 TypeScript 模型

```ts
type DailyRecord = {
  id: string;
  date: string;
  recordDate: string;
  createdAt: string;
  day: number;
  fish: DailyRecordSide;
  cat: DailyRecordSide;
  bonus: number;
  coins: number;
  fishHeat: HeatmapDay;
  catHeat: HeatmapDay;
};
```

## 6.3 字段说明

| 字段       | 类型            | 必填 | 来源                | 是否可导出 | 未来是否进数据库 | 说明                          |
| ---------- | --------------- | ---: | ------------------- | ---------: | ---------------: | ----------------------------- |
| id         | string          |   是 | 系统生成            |         是 |               是 | 记录唯一 ID                   |
| date       | string          |   是 | 系统生成            |         是 |               是 | 展示日期或兼容字段            |
| recordDate | string          |   是 | 用户选择/系统生成   |         是 |               是 | 记录日期，建议格式 YYYY-MM-DD |
| createdAt  | string          |   是 | 系统生成            |         是 |               是 | 创建时间                      |
| day        | number          |   是 | 系统生成            |       可选 |             可选 | 月份中的日期                  |
| fish       | DailyRecordSide |   是 | 用户输入 + 系统计算 |         是 |               是 | 鱼鱼当天记录                  |
| cat        | DailyRecordSide |   是 | 用户输入 + 系统计算 |         是 |               是 | 猫猫当天记录                  |
| bonus      | number          |   是 | 派生计算            |     可导出 |             可选 | 双人 bonus 宝石               |
| coins      | number          |   是 | 派生计算            |     可导出 |             可选 | 当天金币变化                  |
| fishHeat   | HeatmapDay      |   是 | 派生计算            |     可导出 |             可选 | 鱼鱼热力图状态                |
| catHeat    | HeatmapDay      |   是 | 派生计算            |     可导出 |             可选 | 猫猫热力图状态                |

## 6.4 对象关系

```text
DailyRecord
  ├── fish: DailyRecordSide
  ├── cat: DailyRecordSide
  ├── fishHeat: HeatmapDay
  └── catHeat: HeatmapDay
```

## 6.5 建模建议

未来数据库中，`DailyRecord` 应作为核心表。

建议保存原始输入：

```text
recordDate
fish.weightKg
fish.deficit
fish.minutes
cat.weightKg
cat.deficit
cat.minutes
```

`bonus`、`coins`、`fishHeat`、`catHeat` 可以保存快照，但应允许根据规则重新计算。

---

# 7. DailyRecordSide

## 7.1 对象说明

`DailyRecordSide` 表示某一方在某一天的记录。

鱼鱼和猫猫都使用这个结构。

## 7.2 TypeScript 模型

```ts
type DailyRecordSide = {
  weightKg: number | null;
  deficit: number;
  minutes: number;
  gems: number;
};
```

## 7.3 字段说明

| 字段     | 类型   | 必填 | 来源     | 是否可导出 | 未来是否进数据库 | 说明         |
| -------- | ------ | ---: | -------- | ---------: | ---------------: | ------------ |
| weightKg | number | null | 否       |   用户输入 |               是 | 是           |
| deficit  | number |   是 | 用户输入 |         是 |               是 | 热量缺口     |
| minutes  | number |   是 | 用户输入 |         是 |               是 | 运动分钟     |
| gems     | number |   是 | 派生计算 |     可导出 |             可选 | 当天获得宝石 |

## 7.4 建模建议

`weightKg`、`deficit`、`minutes` 是事实数据，必须保存。
`gems` 可以保存快照，也可以由规则计算得出。

---

# 8. TodayRecordPayload

## 8.1 对象说明

`TodayRecordPayload` 表示保存今日记录时传入的载荷。

它不是长期业务对象，而是操作参数。

## 8.2 TypeScript 模型

```ts
type TodayRecordPayload = {
  day: number;
  fish: TodayRecordSidePayload;
  cat: TodayRecordSidePayload;
  fishHeat: HeatmapDay;
  catHeat: HeatmapDay;
  fishGems: number;
  catGems: number;
  bonusGems: number;
  coinDelta: number;
};
```

## 8.3 字段说明

| 字段      | 类型                   | 必填 | 来源      | 是否可导出 | 未来是否进数据库 | 说明           |
| --------- | ---------------------- | ---: | --------- | ---------: | ---------------: | -------------- |
| day       | number                 |   是 | 系统/日期 |         否 |               否 | 操作时的日期   |
| fish      | TodayRecordSidePayload |   是 | 用户输入  |         否 |               否 | 鱼鱼输入       |
| cat       | TodayRecordSidePayload |   是 | 用户输入  |         否 |               否 | 猫猫输入       |
| fishHeat  | HeatmapDay             |   是 | 派生计算  |         否 |               否 | 操作时计算结果 |
| catHeat   | HeatmapDay             |   是 | 派生计算  |         否 |               否 | 操作时计算结果 |
| fishGems  | number                 |   是 | 派生计算  |         否 |               否 | 鱼鱼宝石       |
| catGems   | number                 |   是 | 派生计算  |         否 |               否 | 猫猫宝石       |
| bonusGems | number                 |   是 | 派生计算  |         否 |               否 | 双人 bonus     |
| coinDelta | number                 |   是 | 派生计算  |         否 |               否 | 金币变化       |

## 8.4 建模建议

该对象不应直接进数据库。
数据库应保存最终生成的 `DailyRecord`。

---

# 9. TodayRecordSidePayload

## 9.1 对象说明

表示记录表单中单个人的输入值。

## 9.2 TypeScript 模型

```ts
type TodayRecordSidePayload = {
  weightKg: number | null;
  deficit: number;
  minutes: number;
};
```

## 9.3 字段说明

| 字段     | 类型   | 必填 | 来源     | 是否可导出 | 未来是否进数据库 | 说明     |
| -------- | ------ | ---: | -------- | ---------: | ---------------: | -------- |
| weightKg | number | null | 否       |   用户输入 |         间接导出 | 是       |
| deficit  | number |   是 | 用户输入 |   间接导出 |               是 | 热量缺口 |
| minutes  | number |   是 | 用户输入 |   间接导出 |               是 | 运动分钟 |

---

# 10. ExchangeCategory

## 10.1 对象说明

`ExchangeCategory` 表示兑换商店中的一个奖励类别。

它可以来自程序默认配置，也可以由用户自定义。

## 10.2 TypeScript 模型

```ts
type ExchangeCategory = {
  id: string;
  title: string;
  icon: string;
  description: string;
  resourceKind: ResourceKind;
  price: number;
};
```

## 10.3 字段说明

| 字段         | 类型         | 必填 | 来源          | 是否可导出 | 未来是否进数据库 | 说明           |
| ------------ | ------------ | ---: | ------------- | ---------: | ---------------: | -------------- |
| id           | string       |   是 | 系统生成      |         是 |               是 | 类别 ID        |
| title        | string       |   是 | 内置/用户输入 |         是 |               是 | 奖励名称       |
| icon         | string       |   是 | 内置/用户输入 |         是 |               是 | 奖励图标       |
| description  | string       |   是 | 内置/用户输入 |         是 |               是 | 奖励说明       |
| resourceKind | ResourceKind |   是 | 内置/用户选择 |         是 |               是 | 使用宝石或金币 |
| price        | number       |   是 | 内置/用户输入 |         是 |               是 | 兑换价格       |

## 10.4 对象关系

```text
ExchangeCategory
  └── resourceKind: ResourceKind
```

## 10.5 建模建议

未来数据库中应作为用户配置表或奖励分类表。

默认分类可以不进数据库；用户修改后的分类需要进数据库。

---

# 11. ExchangeRecord

## 11.1 对象说明

`ExchangeRecord` 表示一次奖励兑换行为。

它是用户业务记录数据。

## 11.2 TypeScript 模型

```ts
type ExchangeRecord = {
  id: string;
  date: string;
  createdAt: string;
  occurredAt: string;
  time: string;
  category: string;
  remark: string;
  resourceKind: ResourceKind;
  price: number;
  icon: string;
};
```

## 11.3 字段说明

| 字段         | 类型         | 必填 | 来源              | 是否可导出 | 未来是否进数据库 | 说明         |
| ------------ | ------------ | ---: | ----------------- | ---------: | ---------------: | ------------ |
| id           | string       |   是 | 系统生成          |         是 |               是 | 兑换记录 ID  |
| date         | string       |   是 | 系统生成          |         是 |               是 | 展示日期     |
| createdAt    | string       |   是 | 系统生成          |         是 |               是 | 创建时间     |
| occurredAt   | string       |   是 | 用户选择/系统生成 |         是 |               是 | 实际兑换时间 |
| time         | string       |   是 | 系统生成          |         是 |             可选 | 展示用时间   |
| category     | string       |   是 | 用户选择          |         是 |               是 | 奖励名称快照 |
| remark       | string       |   否 | 用户输入          |         是 |               是 | 兑换备注     |
| resourceKind | ResourceKind |   是 | 类别快照          |         是 |               是 | 消耗资源类型 |
| price        | number       |   是 | 类别快照          |         是 |               是 | 消耗资源数量 |
| icon         | string       |   是 | 类别快照          |         是 |               是 | 奖励图标快照 |

## 11.4 对象关系

```text
ExchangeRecord
  └── resourceKind: ResourceKind
```

## 11.5 建模建议

`ExchangeRecord` 应保存类别快照，而不是只保存 `categoryId`。

原因是用户未来可能修改或删除奖励类别，但历史兑换记录应保持当时的名称、图标和价格。

---

# 12. Wallet

## 12.1 对象说明

`Wallet` 表示当前资源余额。

## 12.2 TypeScript 模型

```ts
type Wallet = {
  gems: number;
  coins: number;
};
```

## 12.3 字段说明

| 字段  | 类型   | 必填 | 来源      | 是否可导出 | 未来是否进数据库 | 说明         |
| ----- | ------ | ---: | --------- | ---------: | ---------------: | ------------ |
| gems  | number |   是 | 派生/快照 |     可导出 |             可选 | 当前宝石余额 |
| coins | number |   是 | 派生/快照 |     可导出 |             可选 | 当前金币余额 |

## 12.4 建模建议

钱包余额可以保存快照，但不应成为唯一事实来源。

长期建议引入 `WalletLedger`，通过流水计算余额。

---

# 13. WalletLedger（未来建议）

## 13.1 对象说明

`WalletLedger` 表示资源变化流水。

当前项目尚未实现，但未来如果接入后端或需要更可靠的资源追踪，建议新增。

## 13.2 建议模型

```ts
type WalletLedger = {
  id: string;
  occurredAt: string;
  resourceKind: ResourceKind;
  amount: number;
  reason: "daily_record" | "exchange" | "adjustment" | "rollback";
  relatedRecordId?: string;
  note?: string;
};
```

## 13.3 字段说明

| 字段            | 类型         | 必填 | 说明                   |
| --------------- | ------------ | ---: | ---------------------- |
| id              | string       |   是 | 流水 ID                |
| occurredAt      | string       |   是 | 发生时间               |
| resourceKind    | ResourceKind |   是 | 宝石或金币             |
| amount          | number       |   是 | 正数为增加，负数为消耗 |
| reason          | string       |   是 | 变化原因               |
| relatedRecordId | string       |   否 | 关联每日记录或兑换记录 |
| note            | string       |   否 | 备注                   |

## 13.4 建模意义

未来可以避免直接修改钱包余额，而是通过流水回算：

```text
钱包余额 = 所有 WalletLedger 之和
```

---

# 14. ResourceKind

## 14.1 对象说明

表示资源类型。

## 14.2 TypeScript 模型

```ts
type ResourceKind = "gem" | "coin";
```

## 14.3 字段说明

| 值   | 说明 |
| ---- | ---- |
| gem  | 宝石 |
| coin | 金币 |

## 14.4 使用位置

```text
ExchangeCategory.resourceKind
ExchangeRecord.resourceKind
WalletLedger.resourceKind，未来
```

---

# 15. HeatmapDay

## 15.1 对象说明

`HeatmapDay` 表示某一天在热力图上的显示状态。

## 15.2 TypeScript 模型

```ts
type HeatmapDay = {
  level: HeatLevel;
  exercise: ExerciseTag;
};
```

## 15.3 字段说明

| 字段     | 类型        | 必填 | 来源     | 是否可导出 | 未来是否进数据库 | 说明             |
| -------- | ----------- | ---: | -------- | ---------: | ---------------: | ---------------- |
| level    | HeatLevel   |   是 | 派生计算 |       可选 |             可选 | 热量缺口完成程度 |
| exercise | ExerciseTag |   是 | 派生计算 |       可选 |             可选 | 运动角标         |

## 15.4 建模建议

它可以由 `deficit + minutes + visualRules` 计算得出。
MVP 阶段可以保存快照，后端阶段建议允许重算。

---

# 16. HeatLevel

## 16.1 对象说明

表示热力图底色等级。

## 16.2 TypeScript 模型

```ts
type HeatLevel = "none" | "ok" | "good" | "perfect";
```

## 16.3 值说明

| 值      | 说明   |
| ------- | ------ |
| none    | 未完成 |
| ok      | 一般   |
| good    | 较好   |
| perfect | 超棒   |

---

# 17. ExerciseTag

## 17.1 对象说明

表示热力图中的运动角标。

## 17.2 TypeScript 模型

```ts
type ExerciseTag = "none" | "run" | "intense";
```

## 17.3 值说明

| 值      | 说明             |
| ------- | ---------------- |
| none    | 无运动           |
| run     | 有运动           |
| intense | 高强度或较长运动 |

---

# 18. HeatmapDayOverrides

## 18.1 对象说明

表示手动覆盖某些日期的热力图状态。

## 18.2 TypeScript 模型

```ts
type HeatmapDayOverrides = Partial<Record<number, HeatmapDay>>;
```

## 18.3 字段说明

| 字段  | 类型       | 说明               |
| ----- | ---------- | ------------------ |
| key   | number     | 日期 day           |
| value | HeatmapDay | 覆盖后的热力图状态 |

## 18.4 建模建议

当前可以保留。
未来如果热力图完全由每日记录生成，则可以减少手动 overrides 的使用。

---

# 19. CoinRulesConfig

## 19.1 对象说明

`CoinRulesConfig` 表示金币计算规则。

## 19.2 TypeScript 模型

```ts
type CoinRulesConfig = {
  weekStartDay: number;
  deficitStreakDays: number;
};
```

## 19.3 字段说明

| 字段              | 类型   | 必填 | 来源      | 是否可导出 | 未来是否进数据库 | 说明         |
| ----------------- | ------ | ---: | --------- | ---------: | ---------------: | ------------ |
| weekStartDay      | number |   是 | 内置/配置 |         是 |               是 | 金币周起始日 |
| deficitStreakDays | number |   是 | 内置/配置 |         是 |               是 | 连续达标天数 |

---

# 20. SettlementVisualRules

## 20.1 对象说明

`SettlementVisualRules` 表示热力图和运动角标的视觉规则。

## 20.2 TypeScript 模型

```ts
type SettlementVisualRules = {
  heatmap: Record<PersonKey, HeatmapThresholds>;
  exerciseTag: ExerciseTagThresholds;
};
```

## 20.3 字段说明

| 字段        | 类型                                 | 必填 | 说明                |
| ----------- | ------------------------------------ | ---: | ------------------- |
| heatmap     | Record<PersonKey, HeatmapThresholds> |   是 | 鱼鱼/猫猫热力图阈值 |
| exerciseTag | ExerciseTagThresholds                |   是 | 运动角标阈值        |

---

# 21. HeatmapThresholds

## 21.1 对象说明

表示某个角色的热力图阈值。

## 21.2 TypeScript 模型

```ts
type HeatmapThresholds = {
  noneMax: number;
  okMin: number;
  goodMin: number;
  perfectMin: number;
};
```

## 21.3 字段说明

| 字段       | 类型   | 说明         |
| ---------- | ------ | ------------ |
| noneMax    | number | 未完成最大值 |
| okMin      | number | 一般最低值   |
| goodMin    | number | 较好最低值   |
| perfectMin | number | 超棒最低值   |

---

# 22. ExerciseTagThresholds

## 22.1 对象说明

表示运动角标阈值。

## 22.2 TypeScript 模型

```ts
type ExerciseTagThresholds = {
  runMin: number;
  intenseMin: number;
};
```

## 22.3 字段说明

| 字段       | 类型   | 说明                       |
| ---------- | ------ | -------------------------- |
| runMin     | number | 显示运动角标的最低分钟数   |
| intenseMin | number | 显示高强度角标的最低分钟数 |

---

# 23. PersonKey

## 23.1 对象说明

表示双人系统中的角色键。

## 23.2 TypeScript 模型

```ts
type PersonKey = "fish" | "cat";
```

## 23.3 使用位置

```text
DailyRecord.fish
DailyRecord.cat
SettlementVisualRules.heatmap
奖励计算函数
热力图计算函数
```

## 23.4 未来建议

未来如果支持自定义角色，可以引入 `PartnerProfile`。

---

# 24. PartnerProfile（未来建议）

## 24.1 对象说明

表示双人空间中的一个成员资料。

当前项目暂未实现，但未来支持昵称、头像、不同角色配置时建议引入。

## 24.2 建议模型

```ts
type PartnerProfile = {
  id: string;
  personKey: PersonKey;
  nickname: string;
  emoji: string;
  colorToken?: string;
};
```

## 24.3 字段说明

| 字段       | 类型      | 必填 | 说明        |
| ---------- | --------- | ---: | ----------- |
| id         | string    |   是 | 成员 ID     |
| personKey  | PersonKey |   是 | fish 或 cat |
| nickname   | string    |   是 | 昵称        |
| emoji      | string    |   是 | 展示图标    |
| colorToken | string    |   否 | UI 颜色标识 |

---

# 25. CoupleSpace（未来建议）

## 25.1 对象说明

表示一个双人共同空间。

当前项目是单本地空间，未来若支持账号和多设备同步，应引入 `CoupleSpace`。

## 25.2 建议模型

```ts
type CoupleSpace = {
  id: string;
  name: string;
  partners: PartnerProfile[];
  createdAt: string;
  configId: string;
};
```

## 25.3 字段说明

| 字段      | 类型             | 必填 | 说明        |
| --------- | ---------------- | ---: | ----------- |
| id        | string           |   是 | 空间 ID     |
| name      | string           |   是 | 空间名称    |
| partners  | PartnerProfile[] |   是 | 双人成员    |
| createdAt | string           |   是 | 创建时间    |
| configId  | string           |   是 | 配置关联 ID |

## 25.4 对象关系

```text
CoupleSpace
  ├── partners: PartnerProfile[]
  ├── dailyRecords: DailyRecord[]
  ├── exchangeRecords: ExchangeRecord[]
  └── config: AppConfigData
```

---

# 26. 对象关系图

```text
AppDataSnapshot
  ├── runtime: UserRuntimeData
  │     ├── wallet: Wallet
  │     ├── dailyRecords: DailyRecord[]
  │     │     ├── fish: DailyRecordSide
  │     │     ├── cat: DailyRecordSide
  │     │     ├── fishHeat: HeatmapDay
  │     │     └── catHeat: HeatmapDay
  │     ├── exchangeRecords: ExchangeRecord[]
  │     ├── fishHeatmapOverrides: HeatmapDayOverrides
  │     └── catHeatmapOverrides: HeatmapDayOverrides
  │
  └── config: AppConfigData
        ├── heatmapStartDate: string
        ├── coinRules: CoinRulesConfig
        ├── visualRules: SettlementVisualRules
        │     ├── heatmap: Record<PersonKey, HeatmapThresholds>
        │     └── exerciseTag: ExerciseTagThresholds
        └── exchangeCategories: ExchangeCategory[]
```

---

# 27. 数据库建模建议

未来进入后端阶段时，建议核心表如下：

```text
couple_spaces
partner_profiles
daily_records
exchange_records
exchange_categories
user_configs
wallet_ledgers
```

## 27.1 必须入库

```text
DailyRecord
DailyRecordSide
ExchangeRecord
ExchangeCategory，自定义部分
AppConfigData
PartnerProfile，未来
CoupleSpace，未来
```

## 27.2 可入库但可重算

```text
Wallet
streakDays
weeklySuccessDays
cumulativeSuccessDays
weekGemTotal
weekCoinTotal
fishHeat
catHeat
```

## 27.3 不应入库

```text
弹窗状态
toast
当前 tab
动画状态
未保存输入草稿
hover 状态
临时 preview
```

---

# 28. 总结

本项目的数据模型核心可以概括为：

```text
DailyRecord 记录每天的努力
ExchangeRecord 记录奖励兑换
ExchangeCategory 定义可兑换奖励
AppConfigData 定义规则和配置
UserRuntimeData 保存用户运行状态
AppDataSnapshot 作为导入导出的整体快照
```

长期建模原则：

```text
事实数据必须保存；
规则配置必须保存；
派生数据可以保存快照但必须能重算；
UI 状态不应持久化；
未来后端应以 daily_records 和 exchange_records 为核心表。
```
