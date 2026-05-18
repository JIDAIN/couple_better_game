# UI Inventory

本文记录当前首页 UI 结构和主要组件状态，避免文档落后于实现。

## 页面

| 路由 | 入口 | 说明 | 状态 |
| --- | --- | --- | --- |
| `/` | `app/page.tsx` -> `HomeScreen` | 情侣共同成长首页，所有核心功能以首页组件和弹窗承载 | 已实现 |

## 首页组件

| 组件 | 文件 | 当前职责 | 数据来源 / 行为 |
| --- | --- | --- | --- |
| `HomeScreen` | `components/home/HomeScreen.tsx` | 组合首页标题、作战进度、资源面板、热力图、鼓励语、记录、日志、兑换和数据管理入口 | 通过 `HomeResourcesProvider` 供数 |
| `GameTitle` | `components/home/GameTitle.tsx` | 首页标题与氛围文案 | 静态展示 |
| `CampaignProgressBadge` | `components/home/CampaignProgressBadge.tsx` | 显示作战开始后的第几天 | 读取 `heatmapStartDate`，客户端挂载后计算 |
| `CoupleGrowthPanel` | `components/home/CoupleGrowthPanel.tsx` | 展示宝石、金币、周累计、连续坚持等概览 | 读取 Provider 派生统计 |
| `DualMonthlyHeatmaps` | `components/home/DualMonthlyHeatmaps.tsx` | 展示鱼鱼和猫猫的月度成长地图 | 支持切月、作战开始日输入；按完整周显示跨月日期；左侧不显示周次 |
| `PlayerHeatmap` | `components/home/PlayerHeatmap.tsx` | 渲染单人热力图星期行和日期格 | 不显示“第几周”；跨月格子使用弱化样式 |
| `HeatmapCell` | `components/home/HeatmapCell.tsx` | 渲染单个热力格、颜色等级和运动角标 | 支持 `muted` 用于跨月日期 |
| `HeatmapLegend` | `components/home/HeatmapLegend.tsx` | 展示热力图颜色和运动角标图例 | 静态展示 |
| `RecordTodayButton` | `components/home/RecordTodayButton.tsx` | 记录今天入口别名 | re-export |
| `RecordTodaySettlement` | `components/home/RecordTodaySettlement.tsx` | 今日记录 / 补录 / 编辑记录弹窗 | 保存后写入 `dailyRecords` 并回算统计 |
| `GrowthLog` | `components/home/GrowthLog.tsx` | 查看、编辑、删除成长日志 | 读取真实 `dailyRecords` |
| `ExchangeShop` | `components/home/ExchangeShop.tsx` | 奖励兑换、兑换记录、商品模板管理 | 兑换记录保存历史快照，不依赖当前商品模板展示 |
| `DataManagement` | `components/home/DataManagement.tsx` | 数据管理入口 | 支持完整备份 JSON 导出/导入、每周复盘 CSV 导出；不支持 CSV 导入 |
| `EncouragementQuote` | `components/home/EncouragementQuote.tsx` | 鼓励语 | 客户端选择文案，避免 hydration mismatch |

## 支撑模块

| 模块 | 文件 | 当前职责 |
| --- | --- | --- |
| `settlement-rules` | `lib/home/settlement-rules.ts` | 热量宝石、运动宝石、恢复日、情侣 bonus、金币、热力图等级和角标规则 |
| `home-stat-service` | `lib/home/home-stat-service.ts` | 钱包、周统计、连击、历史记录重算；宝石钱包按业务日期逐日回放账本并执行每日封顶 |
| `mockHeatmapData` | `components/home/mockHeatmapData.ts` | 动态生成按周六到周五排列的月度热力图网格，包含跨月日期 |
| `export-service` | `lib/home/export-service.ts` | 生成 schemaVersion 1 完整备份 JSON 和带 BOM 的每周复盘 CSV |
| `import-service` | `lib/home/import-service.ts` | 校验并覆盖导入完整备份 JSON，兼容旧兑换记录快照字段 |

## 当前已实现重点

- 每日记录、补录、编辑、删除会回算钱包和统计。
- 鱼鱼运动宝石要求鱼鱼有热量缺口，一起运动 bonus 要求两人都有热量缺口。
- 成长日志详情允许展示负数热量缺口，不再强制显示为 0。
- 宝石钱包按 `dailyRecords + exchangeRecords` 重新计算：每天先加成长宝石并封顶 50，再扣当天兑换消费。
- 热力图支持真实月份切换、跨月首尾周展示，不显示左侧周次。
- 数据管理支持 JSON 备份/恢复和 CSV 导出；右侧内置浏览器无法下载时会在页面内展示内容供手动复制。
