
# 测试指南：双人变美变瘦大作战

# 1. 文档目的

本文档说明项目如何测试、当前有哪些测试文件、每个测试文件覆盖什么、什么情况下必须补充测试，以及如何运行测试。

当前项目使用 **Vitest** 作为测试框架。`package.json` 中已配置测试、监听测试、lint 和构建命令。

---

# 2. 测试命令

## 2.1 运行全部测试

```bash
npm run test
```

对应脚本：

```json
"test": "vitest run"
```

---

## 2.2 监听模式运行测试

```bash
npm run test:watch
```

对应脚本：

```json
"test:watch": "vitest"
```

适合开发过程中边改边跑。

---

## 2.3 代码检查

```bash
npm run lint
```

对应脚本：

```json
"lint": "eslint"
```

---

## 2.4 构建检查

```bash
npm run build
```

对应脚本：

```json
"build": "next build"
```

建议在提交前至少运行：

```bash
npm run test
npm run lint
npm run build
```

---

# 3. 测试目录结构

当前测试主要放在：

```text
tests/home/
```

当前测试文件包括：

```text
tests/home/settlement-rules.test.ts
tests/home/app-data-store.test.ts
tests/home/memory-app-data-store.test.ts
tests/home/home-stat-service.test.ts
tests/home/exchange-service.test.ts
tests/home/daily-record-service.test.ts
tests/home/home-state-service.test.ts
```

---

# 4. 测试分层原则

项目测试应优先覆盖业务逻辑，而不是 UI 样式。

推荐测试优先级：

```text
结算规则 > 统计计算 > 记录服务 > 兑换服务 > 状态恢复 > 存储抽象 > UI 交互
```

原因：

* 宝石、金币、钱包、记录回算是核心逻辑；
* UI 可以频繁调整，但业务结果必须稳定；
* 纯函数和 service 更适合自动化测试；
* 组件样式变化不应导致大量测试失效。

---

# 5. 当前测试文件说明

## 5.1 `settlement-rules.test.ts`

### 覆盖模块

```text
lib/home/settlement-rules.ts
```

### 测试目标

验证结算规则是否正确。

### 当前覆盖内容

该测试文件覆盖：

* 输入解析；
* 体重解析；
* 非负整数解析；
* 鱼鱼热量缺口宝石；
* 猫猫热量缺口宝石；
* 运动宝石；
* 恢复日奖励；
* 单人宝石总和；
* 宝石明细拆分；
* 双人 bonus；
* 热力图等级；
* 运动角标；
* 金币周范围；
* 金币规则触发；
* 连续打卡金币；
* 本周一起运动金币。

### 重点场景

必须覆盖边界值，例如：

```text
199 / 200
299 / 300
499 / 500
99 / 100
199 / 200
29 / 30
59 / 60
```

### 什么时候必须补测试

修改以下内容时必须补测试：

* 宝石规则；
* 金币规则；
* 双人 bonus 规则；
* 恢复日奖励；
* 热力图阈值；
* 运动角标阈值；
* 输入解析逻辑；
* 周期计算逻辑。

---

## 5.2 `app-data-store.test.ts`

### 覆盖模块

```text
lib/home/app-data-store.ts
```

### 测试目标

验证应用数据快照与状态之间的转换是否正确。

### 当前覆盖内容

该测试文件覆盖：

* `HomeResourcesState` 拆分为 `runtime` 和 `config`；
* `AppDataSnapshot` 合并回状态补丁；
* 有效快照识别；
* 无效快照拒绝；
* 旧版扁平状态转换为新版 snapshot。

### 什么时候必须补测试

修改以下内容时必须补测试：

* `AppDataSnapshot` 结构；
* `UserRuntimeData`；
* `AppConfigData`；
* runtime/config 拆分规则；
* 旧数据迁移；
* 导入导出格式；
* snapshot version。

---

## 5.3 `memory-app-data-store.test.ts`

### 覆盖模块

```text
lib/home/memory-app-data-store.ts
```

### 测试目标

验证内存版 Store 是否符合 `AppDataStore` 行为。

### 当前覆盖内容

该测试文件覆盖：

* 空 store 返回 null；
* 保存和读取 snapshot；
* clear 清空数据；
* 不与调用者共享对象引用，避免外部修改污染内部数据。

### 什么时候必须补测试

修改以下内容时必须补测试：

* `AppDataStore` 接口；
* memory store 实现；
* store clone 策略；
* load/save/clear 行为；
* 未来新增 remote store 时，也应参考此测试补充对应用例。

---

## 5.4 `home-stat-service.test.ts`

### 覆盖模块

```text
lib/home/home-stat-service.ts
```

### 测试目标

验证统计计算是否正确。

### 当前覆盖内容

该测试文件覆盖：

* 宝石钱包计算；
* 宝石钱包上限；
* 兑换记录扣减宝石；
* 当前金币周内宝石统计；
* 本周成功打卡天数；
* 金币规则全量重算；
* 默认历史记录导入；
* 金币阈值应该落在真正跨越阈值的日期。

### 什么时候必须补测试

修改以下内容时必须补测试：

* 钱包计算；
* 宝石上限；
* 兑换扣减；
* 本周统计；
* 连续天数；
* 成功打卡判定；
* 金币重算逻辑；
* 历史数据导入逻辑；
* 周起始日规则。

---

## 5.5 `exchange-service.test.ts`

### 覆盖模块

```text
lib/home/exchange-service.ts
```

### 测试目标

验证兑换相关逻辑是否正确。

### 当前覆盖内容

该测试文件覆盖：

* 默认兑换分类与用户覆盖合并；
* 保留自定义兑换分类；
* 新增 / 更新 / 删除分类；
* 兑换记录字段归一化；
* 从兑换 payload 创建兑换记录；
* 兑换记录排序；
* 宝石兑换扣减；
* 金币兑换支出统计。

### 什么时候必须补测试

修改以下内容时必须补测试：

* 默认奖励分类；
* 兑换记录结构；
* 兑换记录排序；
* 奖励分类合并规则；
* 奖励分类删除规则；
* 兑换价格；
* 宝石/金币消耗逻辑；
* 兑换记录归一化逻辑；
* 兑换备注和时间处理。

---

## 5.6 `daily-record-service.test.ts`

### 覆盖模块

```text
lib/home/daily-record-service.ts
```

### 测试目标

验证每日记录新增、编辑、补录、删除及回算逻辑。

### 当前覆盖内容

该测试文件覆盖：

* 创建今日记录；
* 保存今日记录到 state；
* 更新钱包和热力图 overrides；
* 拒绝非法日期；
* 拒绝未来日期；
* 补录历史记录；
* 更新已有历史记录；
* 按日期 upsert 记录，避免重复；
* 只更新已有记录；
* 按日期删除每日记录；
* 按 ID 删除历史记录；
* 删除后回算钱包和统计。

### 什么时候必须补测试

修改以下内容时必须补测试：

* 每日记录创建；
* 今日记录保存；
* 历史补录；
* 历史编辑；
* 记录删除；
* 日期校验；
* 去重规则；
* 钱包回算；
* 热力图 overrides；
* 记录保存后的统计回算；
* `DailyRecord` 字段结构。

---

## 5.7 `home-state-service.test.ts`

### 覆盖模块

```text
lib/home/home-state-service.ts
```

### 测试目标

验证全局状态创建、读取、写入、恢复和容错。

### 当前覆盖内容

该测试文件覆盖：

* 创建默认状态；
* 空 store 时生成默认状态并导入种子记录；
* 写入 store 后再读取；
* 恢复旧版 snapshot；
* 归一化每日记录和兑换分类；
* store 损坏时安全 fallback；
* 读取后重新计算钱包、本周宝石、本周金币等。

### 什么时候必须补测试

修改以下内容时必须补测试：

* 默认状态；
* 本地状态恢复；
* 旧数据迁移；
* snapshot 读取；
* snapshot 写入；
* 默认兑换分类；
* 默认规则；
* 数据损坏兜底；
* 状态初始化流程；
* 导入种子记录逻辑。

---

# 6. 必须补测试的修改类型

以下修改必须补充或更新测试。

## 6.1 改宝石规则

涉及：

```text
gemsFromDeficit
gemsFromExercise
computeRecoveryBonus
gemsForPerson
gemBreakdownForPerson
```

必须更新：

```text
settlement-rules.test.ts
daily-record-service.test.ts，必要时
```

---

## 6.2 改金币规则

涉及：

```text
computeCoinPreview
getCoinWeekRange
isInCoinWeek
recalculateCoinsWithCurrentRules
weekGemTotal
weekCoinTotal
```

必须更新：

```text
settlement-rules.test.ts
home-stat-service.test.ts
daily-record-service.test.ts
```

---

## 6.3 改热力图规则

涉及：

```text
heatLevelFromDeficit
exerciseTagFromMinutes
buildHeatmapDay
visualRules
HeatmapDay
HeatLevel
ExerciseTag
```

必须更新：

```text
settlement-rules.test.ts
daily-record-service.test.ts
```

---

## 6.4 改钱包计算

涉及：

```text
computeGemWallet
sumCoinExchangeSpend
wallet
exchangeRecords
dailyRecords
```

必须更新：

```text
home-stat-service.test.ts
exchange-service.test.ts
daily-record-service.test.ts
```

---

## 6.5 改兑换逻辑

涉及：

```text
redeemExchange
createExchangeRecordFromPayload
normalizeExchangeRecord
orderExchangeRecords
deleteExchangeRecord
exchangeCategories
```

必须更新：

```text
exchange-service.test.ts
home-state-service.test.ts，必要时
```

---

## 6.6 改每日记录逻辑

涉及：

```text
upsertDailyRecordInState
updateDailyRecordInState
deleteDailyRecordFromState
upsertHistoricalRecordInState
deleteHistoricalRecordFromState
```

必须更新：

```text
daily-record-service.test.ts
home-stat-service.test.ts，必要时
```

---

## 6.7 改 snapshot / 数据恢复

涉及：

```text
AppDataSnapshot
snapshotFromHomeResourcesState
snapshotFromLegacyHomeState
homeStatePatchFromSnapshot
readHomeResourcesState
writeHomeResourcesState
```

必须更新：

```text
app-data-store.test.ts
home-state-service.test.ts
memory-app-data-store.test.ts，必要时
```

---

## 6.8 改 localStorage / API store

涉及：

```text
AppDataStore
createLocalStorageAppDataStore
createMemoryAppDataStore
未来 createRemoteAppDataStore
```

必须更新：

```text
memory-app-data-store.test.ts
app-data-store.test.ts
新增 remote-app-data-store.test.ts，未来
```

---

## 6.9 改数据模型

涉及：

```text
DailyRecord
DailyRecordSide
ExchangeRecord
ExchangeCategory
Wallet
AppDataSnapshot
UserRuntimeData
AppConfigData
```

必须更新：

```text
app-data-store.test.ts
home-state-service.test.ts
daily-record-service.test.ts
exchange-service.test.ts
```

---

# 7. 测试覆盖策略

## 7.1 规则层测试

规则层必须覆盖边界值。

例如：

```text
199 / 200
299 / 300
499 / 500
29 / 30
59 / 60
```

这类测试应放在：

```text
settlement-rules.test.ts
```

---

## 7.2 服务层测试

服务层必须覆盖完整状态变化。

例如：

```text
保存记录前后 wallet 是否变化
编辑记录后是否不产生重复记录
删除记录后统计是否回算
兑换后钱包是否扣减
```

这些测试应放在：

```text
daily-record-service.test.ts
exchange-service.test.ts
home-stat-service.test.ts
```

---

## 7.3 Store 层测试

Store 层必须覆盖：

```text
空数据
正常保存读取
旧数据兼容
数据损坏兜底
引用隔离
```

这些测试应放在：

```text
app-data-store.test.ts
memory-app-data-store.test.ts
home-state-service.test.ts
```

---

## 7.4 UI 组件测试，未来

当前阶段可以暂不重点写 UI 自动化测试。

未来如果要补 UI 测试，优先覆盖：

```text
记录今天弹窗
成长日志详情编辑
兑换商店兑换流程
兑换记录编辑
热力图月份切换
```

可考虑引入：

```text
React Testing Library
Playwright
```

---

# 8. 提交前检查清单

每次提交前建议运行：

```bash
npm run test
npm run lint
npm run build
```

如果只改样式，可以至少运行：

```bash
npm run lint
npm run build
```

如果改业务逻辑，必须运行：

```bash
npm run test
```

---

# 9. 回归测试清单

改动后应手动检查核心流程：

```text
记录今天
编辑历史记录
删除历史记录
成长地图更新
成长日志显示
兑换奖励
编辑兑换记录
删除兑换记录
刷新页面数据不丢失
```

尤其需要检查：

```text
钱包余额
本周宝石
本周金币
热力图颜色
成长日志摘要
兑换记录
```

---

# 10. 测试命名规范

建议测试文件命名：

```text
xxx.test.ts
```

建议 describe 命名：

```ts
describe("settlement rules", () => {})
describe("daily record service", () => {})
describe("exchange service", () => {})
```

测试用例命名应描述行为，而不是实现细节：

```ts
it("rejects future historical records", () => {})
it("updates existing daily records without creating duplicates", () => {})
it("deducts gem exchange records from wallet balance", () => {})
```

---

# 11. 新增测试建议

当前测试已经覆盖核心业务，但后续可以补：

## 11.1 GrowthLog 详情数据测试

如果详情页使用独立数据格式化函数，应测试：

```text
💎 +n 格式
🪙 +n 格式
缺口 / 运动 / 恢复文案转换
金币 hint 文案转换
```

## 11.2 兑换记录删除回算测试

如果删除兑换记录会回退资源，应测试：

```text
删除宝石兑换记录后 wallet.gems 回升
删除金币兑换记录后 wallet.coins 回升
```

## 11.3 导入导出测试，未来

如果实现导入导出，应测试：

```text
导出 snapshot 完整性
导入 snapshot 校验
旧版本 snapshot 迁移
重复记录合并
无效文件拒绝
```

## 11.4 Remote Store 测试，未来

如果接入后端 API，应测试：

```text
API load
API save
API error
unauthorized
conflict
network failure
```

---

# 12. 测试原则总结

本项目测试重点是：

```text
规则要准
记录要稳
钱包要对
状态要能恢复
数据不能丢
```

长期原则：

```text
UI 可以频繁调整，但业务规则必须有测试保护。
前端可以预览，但结算逻辑必须可验证。
任何影响宝石、金币、钱包、记录、存储恢复的改动，都必须补测试。
```

当前最重要的测试文件是：

```text
settlement-rules.test.ts
daily-record-service.test.ts
home-stat-service.test.ts
exchange-service.test.ts
home-state-service.test.ts
```

这些测试共同保护项目最核心的业务闭环：

```text
记录 → 结算 → 统计 → 钱包 → 兑换 → 恢复
```
