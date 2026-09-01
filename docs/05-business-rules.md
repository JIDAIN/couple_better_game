# 当前游戏业务规则

> 本文档以当前 `lib/home/settlement-rules.ts`、`home-stat-service.ts` 和 currency semantics v2 为准。

## 1. 先理解金币 / 宝石的 legacy 命名

项目历史上交换过金币与宝石的用户语义，因此内部字段名并不总等于当前 UI 名称。

### 当前用户可见语义

| 用户看到 | 当前存储 / legacy 名称 |
|---|---|
| 每日打卡获得的 **金币** | `fish.gems`、`cat.gems`、`bonus`、`wallet.coins` |
| 周期规则获得的 **宝石** | `DailyRecord.coins`、`wallet.gems` |
| 本周金币 | `weekCoinTotal` |
| 本周宝石 | `weekGemTotal` |
| 昨日金币 | legacy 字段 `yesterdayGemTotal` |

`currency-semantics.ts` 当前版本：

```text
CURRENT_CURRENCY_SEMANTICS_VERSION = 2
```

**禁止只根据函数名 `gemsFromDeficit` / `computeCoinPreview` 猜 UI 币种。**

## 2. 每日金币：鱼鱼

基础 deficit：

| deficit | 金币 |
|---:|---:|
| < 200 | 0 |
| 200–299 | +1 |
| 300–499 | +2 |
| >= 500 | +4 |

运动金币只有当天 `deficit > 0` 才触发：

| 运动 | 金币 |
|---:|---:|
| < 30 min | 0 |
| >= 30 min | +1 |

## 3. 每日金币：猫猫

基础 deficit：

| deficit | 金币 |
|---:|---:|
| < 100 | 0 |
| 100–199 | +1 |
| >= 200 | +2 |

运动金币同样要求当天 `deficit > 0`：

| 运动 | 金币 |
|---:|---:|
| < 30 min | 0 |
| 30–59 min | +1 |
| >= 60 min | +2 |

## 4. 恢复日奖励

当前代码实际条件：

```text
今天该成员 deficit > 0
AND
昨天该成员 exercise_minutes >= 30
=> 今天额外 +1 金币
```

**当前实现并不要求今天不运动。**

因此恢复奖励可以与今天的运动金币同时叠加。旧文档中“今天不运动才 +1”的描述已经废弃。

## 5. 双人同行奖励

条件：

```text
鱼鱼 deficit > 0
猫猫 deficit > 0
鱼鱼运动 >= 30
猫猫运动 >= 30
```

结果：

```text
共 +2 金币（双方各 +1 的业务含义）
```

记录在 `DailyRecord.bonus` legacy 字段。

## 6. 当日金币总量

```text
鱼鱼基础 + 鱼鱼运动 + 鱼鱼恢复
+
猫猫基础 + 猫猫运动 + 猫猫恢复
+
双人同行 bonus
```

这部分是用户界面中的每日“金币”。

## 7. 金币钱包上限

当前 `computeCoinWallet()` 按业务日期回放：

```text
当天先加入该日获得金币
-> 余额封顶 50
-> 再扣除当天 coin 兑换
-> 最低不小于 0
```

因此当前 **coin wallet 上限 = 50**。

内部常量仍叫 `GEM_CAP`，这是历史命名，不代表用户可见宝石上限。

## 8. 宝石触发规则

当前周期奖励函数内部名为 `computeCoinPreview()`，结果写到 `DailyRecord.coins`，但 currency semantics v2 下用户看到的是**宝石**。

### 8.1 本周金币跨阈值

当本周金币累计第一次跨过：

- 30：+1 宝石
- 50：再 +1 宝石

同一次结算如果从低于 30 一次跨过 50，可以同时触发两条。

### 8.2 双人连续达标

“达标”定义为双方都达到各自热力图 `ok` 下限：

```text
fish deficit >= 200
cat deficit >= 100
```

当前 `coinRules.deficitStreakDays = 5`。

在当前业务周内首次达到连续 5 天时：

```text
+1 宝石
```

连续统计在周起始日前停止，不跨业务周追溯。

### 8.3 本周一起运动 2 次

一次“一起运动”定义：

```text
fish minutes >= 30
AND cat minutes >= 30
```

达到本周第 2 次时：

```text
+1 宝石
```

**这个宝石阈值函数当前不额外检查 deficit。** 不要与第 5 节的“双人同行 +2 金币”条件混为一谈。

## 9. 宝石钱包

当前 `wallet.gems` 根据 `DailyRecord.coins`（周期宝石）与 `resourceKind="gem"` 的兑换支出重算。

当前代码没有像金币钱包那样对宝石余额应用 50 上限。

## 10. 业务周

```text
weekStartDay = 6
```

JavaScript `Date.getDay()` 中 6 = 周六。

所以统一业务周：

```text
周六 -> 周五
```

用于：

- 周金币 / 宝石统计
- 连续达标规则边界
- 一起运动次数
- CSV 周次
- 热力图行视觉口径

## 11. 热力图

### 鱼鱼 deficit 等级

| deficit | level |
|---:|---|
| < 200 | none |
| 200–299 | ok |
| 300–499 | good |
| >= 500 | perfect |

### 猫猫 deficit 等级

| deficit | level |
|---:|---|
| < 100 | none |
| 100–199 | ok |
| 200–299 | good |
| >= 300 | perfect |

### 运动角标

| 运动 | tag |
|---:|---|
| 0 | none |
| 1–59 | run |
| >= 60 | intense |

注意：运动奖励阈值与热力图运动角标阈值是两个不同规则。

## 12. 成功打卡定义

当前成功日：

```text
fish deficit >= 200
AND cat deficit >= 100
```

用于 `weeklySuccessDays`、`cumulativeSuccessDays` 等统计。

## 13. 历史编辑与回算

历史每日记录变更后，应重建：

- 当日奖励结果；
- 周期宝石；
- 钱包；
- 周统计；
- success days；
- heatmap overrides。

不要只修改 UI 展示字段。

## 14. 与饮食摄入的边界

所有上述 deficit 规则只消费游戏 `deficit` 字段。

```text
meal calories 不自动生成 deficit
meal calories 不自动触发金币
meal calories 不自动修改热力图
```

未来如果希望把“真实摄入 -> deficit”建立关系，必须作为新的明确产品规则设计，而不是在 meal API 中顺手实现。
