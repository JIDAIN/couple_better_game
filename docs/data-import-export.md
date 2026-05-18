# 数据备份与恢复

本项目的数据管理功能只面向本地数据备份，不包含登录、数据库、云同步、GitHub 同步或 CSV 导入。

首页入口为“📤 数据管理”。在普通 Chrome 中会触发文件下载；在 Codex 右侧内置浏览器等下载能力受限的环境中，导出结果会显示在页面内，用户可以打开预览、复制内容或手动选中全部内容。

## 完整备份 JSON

备份 JSON 使用 `schemaVersion: 1`，包含：

- `schemaVersion`
- `exportedAt`
- `wallet`
- `dailyRecords`
- `exchangeRecords`
- `exchangeCategories`
- `heatmapStartDate`
- `coinRules`
- `visualRules`

导入 JSON 是覆盖导入，不做合并。导入前会显示确认弹窗：

> 导入会覆盖当前本地数据，确认继续吗？

如果 JSON 解析失败、版本不支持或关键字段缺失，导入会中止，当前本地数据不会被修改。

## 兑换记录快照

`exchangeCategories` 表示当前兑换商品模板。

`exchangeRecords` 表示历史兑换快照。每条历史记录都应独立保存兑换当时的：

- `category`
- `icon`
- `resourceKind`
- `price`
- `remark`

历史兑换记录展示只读取 `exchangeRecords` 中的快照字段，不依赖当前 `exchangeCategories`。因此商品被改名、改价或删除后，历史记录仍会按当时兑换内容显示。

导入旧数据时，兑换记录兼容规则：

- 缺 `category` 时使用 `未知兑换`
- 缺 `icon` 时使用 `🎁`
- 缺 `resourceKind` 时使用 `gem`
- 缺 `price` 时使用 `0`
- 如果有 `categoryId` 但缺快照字段，会尝试从导入包里的 `exchangeCategories` 补齐一次

## 每周复盘 CSV

CSV 只支持导出，不支持导入。

字段顺序：

```text
周次,日期,鱼鱼缺口kcal,鱼鱼运动min,鱼鱼宝石,猫猫缺口kcal,猫猫运动min,猫猫宝石,情侣bonus,当日总宝石,金币变化
```

导出规则：

- 按 `recordDate` 升序
- 周次按周六到周五计算
- 如果有 `heatmapStartDate`，从作战开始日所在周算第 1 周
- 文件包含 UTF-8 BOM，方便 Excel 直接打开中文
