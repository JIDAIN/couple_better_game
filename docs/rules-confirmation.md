# 记录结算规则与 UI 对应关系

| 规则 | UI 对应位置 | 当前实现状态 | 数据来源 | 后续优化 |
|---|---|---|---|---|
| 共享宝石上限 50 | `CoupleGrowthPanel` 宝石进度条、`ExchangeShop` 余额标签 | 已实现，常量集中在 `settlement-rules.ts` 的 `GEM_CAP` | `HomeResourcesProvider.wallet.gems` | 如后续有赛季或等级，可再调整上限来源 |
| 鱼鱼热量宝石：200 kcal = 1，300 kcal = 2，500 kcal = 4 | `RecordTodaySettlement` 鱼鱼“今日宝石”预览；`GrowthLog` 鱼鱼详情 | 已实现，`gemsFromDeficit("fish", deficit)` | 当日输入；确认后写入 `dailyRecords[].fish.gems` | 可在 UI 中进一步拆分展示“热量 / 运动 / 恢复日”明细 |
| 猫猫热量宝石：100 kcal = 1，200 kcal = 2 | `RecordTodaySettlement` 猫猫“今日宝石”预览；`GrowthLog` 猫猫详情 | 已实现，`gemsFromDeficit("cat", deficit)` | 当日输入；确认后写入 `dailyRecords[].cat.gems` | 可在 UI 中进一步拆分展示“热量 / 运动 / 恢复日”明细 |
| 鱼鱼运动宝石：运动 >=30min 得 1 颗，最多 1 颗 | `RecordTodaySettlement` 鱼鱼“今日宝石”预览；`GrowthLog` 鱼鱼详情 | 已实现，计入个人今日宝石，`gemsFromExercise("fish", minutes, hasDeficit)` | 当日输入 | 如后续规则变化，只改 `settlement-rules.ts` |
| 猫猫运动宝石：有热量缺口时，>=30min 得 1，>=60min 得 2；无热量缺口不触发 | `RecordTodaySettlement` 猫猫“今日宝石”预览；`GrowthLog` 猫猫详情 | 已实现，计入个人今日宝石，`gemsFromExercise("cat", minutes, hasDeficit)` | 当日输入 | 如需提示“无缺口不触发”，可在预览文案中增加轻提示 |
| 恢复日奖励：昨天运动 >=30min，今天有热量缺口且不运动也 +1 | `RecordTodaySettlement` 双方“今日宝石”预览；`GrowthLog` 双方详情 | 已实现，`computeRecoveryBonus(person, todayInput, yesterdayRecord)` 已基于昨日 `dailyRecords` 接入 | `dailyRecords` 中 `day === todayDay - 1` 的记录 | 当前只按 5 月 day 查找昨天；跨月或真实周历可后续增强 |
| 一起运动奖励：双方当天运动都 >=30min，双方各 +1，共 +2 | `RecordTodaySettlement` “情侣 bonus”区域；`GrowthLog` “情侣 bonus”详情；共享宝石库存 | 已实现，`computeCoupleBonus()` 返回 `gems: 2`，并在 `HomeResourcesProvider.applyTodayRecord()` 加入共享宝石 | 当日双方运动输入；确认后写入 `dailyRecords[].bonus` | 可后续把 bonus 明细拆为专门字段，但当前不需要改数据结构 |
| 金币：本周新增宝石 >=30 得 +1，>=50 得 +2 | `RecordTodaySettlement` “金币变化”预览；`CoupleGrowthPanel` 本周金币 / 金币存量；`GrowthLog` 金币详情 | 已集中到 `computeCoinPreview()`；当前为即时跨线版：从当前 `weekGemTotal` 到本次结算后总数跨过 30 / 50 时发放 | `weekGemTotal` + 本次新增宝石 | 后续需要更严格的真实周边界、周重置和历史重算 |
| 金币：两人连续 5 天打卡，且每天都有热量缺口，得 +1 | `RecordTodaySettlement` “金币变化”预览；`GrowthLog` 金币详情 | 已集中到 `computeCoinPreview()`；当前基于 `dailyRecords` 的连续 day 推算，并在达到第 5 天时发放 | `dailyRecords[].fish.deficit`、`dailyRecords[].cat.deficit`、本日输入 | 后续需要处理编辑 / 删除记录后的重算 |
| 金币：本周一起运动 >=2 次，得 +1 | `RecordTodaySettlement` “金币变化”预览；`GrowthLog` 金币详情 | 已集中到 `computeCoinPreview()`；当前按 5 月 day 的 7 日分段作为简化周，达到第 2 次时发放 | `dailyRecords` 中双方运动时长 + 本日输入 | 后续需要接入真实自然周边界 |
| 热力图颜色等级：0 = 未完成；1-279 kcal = 一般；280-519 kcal = 较好；>=520 kcal = 超棒 | `DualMonthlyHeatmaps` 月度热力图；`HeatmapLegend` 图例 | 沿用现有等级，集中在 `heatLevelFromDeficit()` | 当日输入经 `buildHeatmapDay()` 写入 heatmap overrides | 若想严格区分鱼鱼 / 猫猫阈值，可后续调整色阶 |
| 运动热力图角标：0 = 无；1-39min = 有运动；>=40min = 高强度 | `DualMonthlyHeatmaps` 月度热力图；`HeatmapLegend` 图例 | 沿用现有等级，集中在 `exerciseTagFromMinutes()` | 当日输入经 `buildHeatmapDay()` 写入 heatmap overrides | 可后续按 30 / 60min 新规则同步角标阈值 |
| 兑换余额检查 | `ExchangeShop` 兑换按钮可用性、确认兑换扣减 | 已检查，仍只读取共享宝石 / 金币余额；本次未修改默认分类、价格、消费流程 | `HomeResourcesProvider.gemStock`、`coinStock` | 不实现双方同意 / 否决机制 |
# 当前实现同步说明（2026-05）

当前规则已确认：鱼鱼运动宝石必须在鱼鱼存在热量缺口时触发；情侣运动 bonus 必须双方都有热量缺口时触发。宝石钱包按业务日期账本回放，每天先加成长宝石并封顶 50，再扣当天兑换消费。
