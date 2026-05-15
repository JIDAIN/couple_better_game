
# 数据库设计草案：双人变美变瘦大作战

# 1. 文档目的

本文档用于描述项目未来接入后端数据库时的初步表结构设计，包括：

* 未来需要哪些表；
* 每张表保存什么数据；
* 表之间的关系；
* 唯一约束；
* 常用索引；
* 哪些字段是事实数据，哪些字段是派生快照。

当前前端模型中已经存在 `DailyRecord`、`DailyRecordSide`、`ExchangeCategory`、`ExchangeRecord`、`Wallet`、`CoinRulesConfig`、`SettlementVisualRules`、`AppDataSnapshot` 等核心数据对象，可作为数据库设计的基础参考。

---

# 2. 设计原则

## 2.1 保存事实数据，派生数据可回算

数据库应优先保存用户真实输入和业务事实，例如：

```text
每日记录日期
体重
热量缺口
运动分钟
兑换记录
兑换备注
兑换时间
奖励分类配置
```

宝石、金币、热力图状态、连续天数、周统计等属于派生结果，可以保存快照，但不应作为唯一事实来源。

---

## 2.2 钱包建议用流水保证一致性

未来不建议只依赖一个 `Wallet` 余额字段。

更稳的方式是：

```text
Wallet 保存当前余额快照
WalletLedger 保存每一次资源变化
```

这样编辑历史记录、删除记录、撤销兑换时，都可以通过流水追踪资源变化。

---

## 2.3 历史记录应保存快照

兑换记录应保存当时的奖励名称、图标、价格、资源类型，而不能只依赖当前奖励分类。

因为用户未来可能修改或删除奖励分类，但历史记录仍应保留当时兑换的样子。

---

# 3. 表总览

建议未来数据库包含以下核心表：

```text
User
CoupleSpace
Membership
PartnerProfile
AppConfig
DailyRecord
DailyRecordSide
Wallet
WalletLedger
ExchangeCategory
ExchangeRecord
```

可选扩展表：

```text
DataExportJob
AuditLog
DeviceSession
```

---

# 4. User 用户表

## 4.1 用途

保存登录用户的基础账号信息。

当前 MVP 可以不实现登录，但未来多设备同步、情侣绑定、权限控制都需要用户表。

## 4.2 字段

| 字段        | 类型          | 必填 | 说明       |
| ----------- | ------------- | ---: | ---------- |
| id          | string / uuid |   是 | 用户 ID    |
| email       | string        |   否 | 邮箱       |
| phone       | string        |   否 | 手机号     |
| displayName | string        |   否 | 展示名     |
| avatarUrl   | string        |   否 | 头像       |
| createdAt   | datetime      |   是 | 创建时间   |
| updatedAt   | datetime      |   是 | 更新时间   |
| deletedAt   | datetime      |   否 | 软删除时间 |

## 4.3 关系

```text
User 1 - n Membership
User 1 - n CoupleSpace，通过 Membership 关联
```

## 4.4 约束

```text
email 唯一，可为空
phone 唯一，可为空
```

## 4.5 索引

```text
idx_user_email
idx_user_phone
idx_user_created_at
```

---

# 5. CoupleSpace 情侣空间表

## 5.1 用途

表示一个双人共同成长空间。

一个空间下有两个人、每日记录、兑换记录、奖励分类和配置。

## 5.2 字段

| 字段        | 类型          | 必填 | 说明          |
| ----------- | ------------- | ---: | ------------- |
| id          | string / uuid |   是 | 空间 ID       |
| name        | string        |   是 | 空间名称      |
| ownerUserId | string        |   是 | 创建者用户 ID |
| createdAt   | datetime      |   是 | 创建时间      |
| updatedAt   | datetime      |   是 | 更新时间      |
| archivedAt  | datetime      |   否 | 归档时间      |

## 5.3 关系

```text
CoupleSpace 1 - n Membership
CoupleSpace 1 - n PartnerProfile
CoupleSpace 1 - 1 AppConfig
CoupleSpace 1 - n DailyRecord
CoupleSpace 1 - n ExchangeCategory
CoupleSpace 1 - n ExchangeRecord
CoupleSpace 1 - 1 Wallet
CoupleSpace 1 - n WalletLedger
```

## 5.4 约束

```text
ownerUserId 必须存在于 User
```

## 5.5 索引

```text
idx_couple_space_owner_user_id
idx_couple_space_created_at
```

---

# 6. Membership 空间成员表

## 6.1 用途

表示用户和情侣空间之间的关系。

未来如果只有两个人，也建议保留 Membership 表，方便权限控制和多设备同步。

## 6.2 字段

| 字段          | 类型          | 必填 | 说明                    |
| ------------- | ------------- | ---: | ----------------------- |
| id            | string / uuid |   是 | 成员关系 ID             |
| coupleSpaceId | string        |   是 | 空间 ID                 |
| userId        | string        |   是 | 用户 ID                 |
| role          | enum          |   是 | owner / member          |
| status        | enum          |   是 | active / invited / left |
| joinedAt      | datetime      |   否 | 加入时间                |
| createdAt     | datetime      |   是 | 创建时间                |
| updatedAt     | datetime      |   是 | 更新时间                |

## 6.3 关系

```text
Membership n - 1 User
Membership n - 1 CoupleSpace
```

## 6.4 唯一约束

```text
unique(coupleSpaceId, userId)
```

## 6.5 索引

```text
idx_membership_user_id
idx_membership_couple_space_id
idx_membership_status
```

---

# 7. PartnerProfile 角色资料表

## 7.1 用途

保存空间内两个角色的信息，例如鱼鱼、猫猫、昵称、emoji、颜色等。

当前前端模型中角色键为 `fish | cat`。

## 7.2 字段

| 字段          | 类型          | 必填 | 说明                          |
| ------------- | ------------- | ---: | ----------------------------- |
| id            | string / uuid |   是 | 角色资料 ID                   |
| coupleSpaceId | string        |   是 | 所属空间                      |
| userId        | string        |   否 | 绑定的用户 ID，未绑定时可为空 |
| partnerKey    | enum          |   是 | fish / cat                    |
| nickname      | string        |   是 | 昵称                          |
| emoji         | string        |   是 | 展示图标                      |
| colorToken    | string        |   否 | UI 颜色标识                   |
| createdAt     | datetime      |   是 | 创建时间                      |
| updatedAt     | datetime      |   是 | 更新时间                      |

## 7.3 关系

```text
PartnerProfile n - 1 CoupleSpace
PartnerProfile n - 0/1 User
```

## 7.4 唯一约束

```text
unique(coupleSpaceId, partnerKey)
unique(coupleSpaceId, userId)，userId 非空时
```

## 7.5 索引

```text
idx_partner_profile_space_id
idx_partner_profile_user_id
```

---

# 8. AppConfig 应用配置表

## 8.1 用途

保存某个情侣空间的规则和配置。

当前前端配置数据包括：

```text
heatmapStartDate
coinRules
visualRules
exchangeCategories
```

其中 `coinRules` 和 `visualRules` 已在当前类型模型中定义。

## 8.2 字段

| 字段                  | 类型          | 必填 | 说明                 |
| --------------------- | ------------- | ---: | -------------------- |
| id                    | string / uuid |   是 | 配置 ID              |
| coupleSpaceId         | string        |   是 | 空间 ID              |
| heatmapStartDate      | date          |   是 | 热力图 / 作战开始日  |
| coinWeekStartDay      | int           |   是 | 金币周起始日         |
| coinDeficitStreakDays | int           |   是 | 连续达标天数         |
| visualRulesJson       | json          |   是 | 热力图和运动角标规则 |
| createdAt             | datetime      |   是 | 创建时间             |
| updatedAt             | datetime      |   是 | 更新时间             |

## 8.3 关系

```text
AppConfig 1 - 1 CoupleSpace
```

## 8.4 唯一约束

```text
unique(coupleSpaceId)
```

## 8.5 索引

```text
idx_app_config_space_id
```

## 8.6 说明

`visualRulesJson` 可以保存类似：

```json
{
  "heatmap": {
    "fish": {
      "noneMax": 199,
      "okMin": 200,
      "goodMin": 300,
      "perfectMin": 500
    },
    "cat": {
      "noneMax": 99,
      "okMin": 100,
      "goodMin": 200,
      "perfectMin": 300
    }
  },
  "exerciseTag": {
    "runMin": 1,
    "intenseMin": 60
  }
}
```

---

# 9. DailyRecord 每日记录表

## 9.1 用途

表示某一天的整体记录。

一条 `DailyRecord` 对应某个情侣空间某一天的记录。当前前端模型中 `DailyRecord` 包含日期、鱼鱼、猫猫、bonus、coins、fishHeat、catHeat 等字段。

数据库中建议将整体记录和双方明细拆成两张表：

```text
DailyRecord：保存日期和整体结果
DailyRecordSide：保存 fish/cat 各自输入和结果
```

## 9.2 字段

| 字段            | 类型          | 必填 | 说明               |
| --------------- | ------------- | ---: | ------------------ |
| id              | string / uuid |   是 | 每日记录 ID        |
| coupleSpaceId   | string        |   是 | 所属空间           |
| recordDate      | date          |   是 | 记录日期           |
| bonusGems       | int           |   是 | 情侣 bonus 宝石    |
| coinDelta       | int           |   是 | 当天金币变化       |
| note            | string        |   否 | 当天备注，未来可用 |
| createdByUserId | string        |   否 | 创建者             |
| createdAt       | datetime      |   是 | 创建时间           |
| updatedAt       | datetime      |   是 | 更新时间           |
| deletedAt       | datetime      |   否 | 软删除时间         |

## 9.3 关系

```text
DailyRecord n - 1 CoupleSpace
DailyRecord 1 - n DailyRecordSide
DailyRecord 1 - n WalletLedger
```

## 9.4 唯一约束

```text
unique(coupleSpaceId, recordDate)
```

如果使用软删除，需要考虑：

```text
unique(coupleSpaceId, recordDate, deletedAt)
```

或在数据库中使用 partial unique index：

```text
unique(coupleSpaceId, recordDate) where deletedAt is null
```

## 9.5 索引

```text
idx_daily_record_space_date
idx_daily_record_space_created_at
idx_daily_record_created_by
```

## 9.6 说明

`bonusGems`、`coinDelta` 是派生结果，但建议保存快照，便于历史展示和避免规则变化后历史表现不稳定。

如果未来规则调整，需要明确是否重算历史记录。

---

# 10. DailyRecordSide 每日角色明细表

## 10.1 用途

表示某一天某个角色的记录。

当前前端模型中 `DailyRecordSide` 包含：

```text
weightKg
deficit
minutes
gems
```

这些字段已在类型定义中存在。

## 10.2 字段

| 字段          | 类型          | 必填 | 说明                       |
| ------------- | ------------- | ---: | -------------------------- |
| id            | string / uuid |   是 | 明细 ID                    |
| dailyRecordId | string        |   是 | 所属每日记录               |
| coupleSpaceId | string        |   是 | 冗余空间 ID，便于查询      |
| partnerKey    | enum          |   是 | fish / cat                 |
| weightKg      | decimal       |   否 | 当天体重                   |
| deficit       | int           |   是 | 热量缺口                   |
| minutes       | int           |   是 | 运动分钟                   |
| gems          | int           |   是 | 当天获得宝石               |
| heatLevel     | enum          |   是 | none / ok / good / perfect |
| exerciseTag   | enum          |   是 | none / run / intense       |
| createdAt     | datetime      |   是 | 创建时间                   |
| updatedAt     | datetime      |   是 | 更新时间                   |

## 10.3 关系

```text
DailyRecordSide n - 1 DailyRecord
DailyRecordSide n - 1 CoupleSpace
```

## 10.4 唯一约束

```text
unique(dailyRecordId, partnerKey)
```

## 10.5 索引

```text
idx_daily_record_side_record_id
idx_daily_record_side_space_partner
idx_daily_record_side_partner_date，可通过 join DailyRecord 查询
```

## 10.6 说明

`deficit`、`minutes`、`weightKg` 是事实数据。
`gems`、`heatLevel`、`exerciseTag` 是派生快照。

---

# 11. Wallet 钱包表

## 11.1 用途

保存某个情侣空间当前资源余额快照。

当前前端模型中 `Wallet` 为：

```ts
type Wallet = {
  gems: number;
  coins: number;
}
```

## 11.2 字段

| 字段          | 类型          | 必填 | 说明     |
| ------------- | ------------- | ---: | -------- |
| id            | string / uuid |   是 | 钱包 ID  |
| coupleSpaceId | string        |   是 | 所属空间 |
| gemsBalance   | int           |   是 | 宝石余额 |
| coinsBalance  | int           |   是 | 金币余额 |
| updatedAt     | datetime      |   是 | 更新时间 |

## 11.3 关系

```text
Wallet 1 - 1 CoupleSpace
Wallet 1 - n WalletLedger
```

## 11.4 唯一约束

```text
unique(coupleSpaceId)
```

## 11.5 索引

```text
idx_wallet_space_id
```

## 11.6 说明

钱包余额是快照，不建议作为唯一事实来源。
未来应结合 `WalletLedger` 保证可追踪和可回算。

---

# 12. WalletLedger 钱包流水表

## 12.1 用途

记录每一次宝石或金币变化。

包括：

```text
每日记录获得资源
编辑记录产生差额
删除记录回滚资源
兑换奖励消耗资源
删除兑换记录回退资源
手动调整，未来
```

## 12.2 字段

| 字段                    | 类型          | 必填 | 说明                                                                            |
| ----------------------- | ------------- | ---: | ------------------------------------------------------------------------------- |
| id                      | string / uuid |   是 | 流水 ID                                                                         |
| coupleSpaceId           | string        |   是 | 所属空间                                                                        |
| walletId                | string        |   是 | 钱包 ID                                                                         |
| resourceKind            | enum          |   是 | gem / coin                                                                      |
| amount                  | int           |   是 | 变化数量，正数增加，负数减少                                                    |
| reason                  | enum          |   是 | daily_record / exchange / edit_adjustment / delete_rollback / manual_adjustment |
| relatedDailyRecordId    | string        |   否 | 关联每日记录                                                                    |
| relatedExchangeRecordId | string        |   否 | 关联兑换记录                                                                    |
| description             | string        |   否 | 描述                                                                            |
| occurredAt              | datetime      |   是 | 发生时间                                                                        |
| createdAt               | datetime      |   是 | 创建时间                                                                        |

## 12.3 关系

```text
WalletLedger n - 1 Wallet
WalletLedger n - 1 CoupleSpace
WalletLedger n - 0/1 DailyRecord
WalletLedger n - 0/1 ExchangeRecord
```

## 12.4 约束

建议约束：

```text
amount != 0
resourceKind in gem / coin
reason 必须合法
```

如果 `reason = daily_record`，应有关联 `relatedDailyRecordId`。
如果 `reason = exchange`，应有关联 `relatedExchangeRecordId`。

## 12.5 索引

```text
idx_wallet_ledger_space_created_at
idx_wallet_ledger_wallet_id
idx_wallet_ledger_resource_kind
idx_wallet_ledger_related_daily_record
idx_wallet_ledger_related_exchange_record
```

## 12.6 说明

这是保证钱包一致性的关键表。

未来推荐：

```text
钱包余额 = Wallet 快照
钱包可信来源 = WalletLedger 流水
```

---

# 13. ExchangeCategory 奖励分类表

## 13.1 用途

保存兑换商店中的奖励类别。

当前前端模型中 `ExchangeCategory` 包含：

```text
id
title
icon
description
resourceKind
price
```

## 13.2 字段

| 字段          | 类型          | 必填 | 说明         |
| ------------- | ------------- | ---: | ------------ |
| id            | string / uuid |   是 | 奖励分类 ID  |
| coupleSpaceId | string        |   是 | 所属空间     |
| title         | string        |   是 | 奖励名称     |
| icon          | string        |   是 | 奖励图标     |
| description   | string        |   是 | 奖励说明     |
| resourceKind  | enum          |   是 | gem / coin   |
| price         | int           |   是 | 价格         |
| sortOrder     | int           |   否 | 排序         |
| isDefault     | boolean       |   是 | 是否默认分类 |
| isActive      | boolean       |   是 | 是否启用     |
| createdAt     | datetime      |   是 | 创建时间     |
| updatedAt     | datetime      |   是 | 更新时间     |
| deletedAt     | datetime      |   否 | 软删除时间   |

## 13.3 关系

```text
ExchangeCategory n - 1 CoupleSpace
ExchangeCategory 1 - n ExchangeRecord，历史记录可不强依赖
```

## 13.4 约束

```text
price > 0
resourceKind in gem / coin
```

可选唯一约束：

```text
unique(coupleSpaceId, title) where deletedAt is null
```

## 13.5 索引

```text
idx_exchange_category_space_id
idx_exchange_category_space_active
idx_exchange_category_resource_kind
idx_exchange_category_sort_order
```

## 13.6 说明

即使分类被删除，历史兑换记录也不能丢失。
因此 `ExchangeRecord` 必须保存兑换时的分类快照。

---

# 14. ExchangeRecord 兑换记录表

## 14.1 用途

保存用户每一次兑换奖励的行为。

当前前端模型中 `ExchangeRecord` 包含日期、兑换时间、类别、备注、资源类型、价格和图标。

## 14.2 字段

| 字段                  | 类型          | 必填 | 说明                    |
| --------------------- | ------------- | ---: | ----------------------- |
| id                    | string / uuid |   是 | 兑换记录 ID             |
| coupleSpaceId         | string        |   是 | 所属空间                |
| exchangeCategoryId    | string        |   否 | 当前奖励分类 ID，可为空 |
| occurredAt            | datetime      |   是 | 实际兑换时间            |
| categoryTitleSnapshot | string        |   是 | 兑换时的奖励名称        |
| iconSnapshot          | string        |   是 | 兑换时的图标            |
| resourceKind          | enum          |   是 | gem / coin              |
| price                 | int           |   是 | 消耗资源数量            |
| remark                | string        |   否 | 用户备注                |
| createdByUserId       | string        |   否 | 创建者                  |
| createdAt             | datetime      |   是 | 创建时间                |
| updatedAt             | datetime      |   是 | 更新时间                |
| deletedAt             | datetime      |   否 | 软删除时间              |

## 14.3 关系

```text
ExchangeRecord n - 1 CoupleSpace
ExchangeRecord n - 0/1 ExchangeCategory
ExchangeRecord 1 - n WalletLedger
```

## 14.4 约束

```text
price > 0
resourceKind in gem / coin
```

## 14.5 索引

```text
idx_exchange_record_space_occurred_at
idx_exchange_record_space_created_at
idx_exchange_record_category_id
idx_exchange_record_resource_kind
```

## 14.6 说明

`categoryTitleSnapshot`、`iconSnapshot`、`price`、`resourceKind` 必须保存当时快照。

不要只保存 `exchangeCategoryId`，否则分类修改后会影响历史记录展示。

---

# 15. 可选表：DataExportJob 数据导出任务

## 15.1 用途

未来如果数据较大，或导出过程需要异步，可以增加该表。

## 15.2 字段

| 字段              | 类型          | 必填 | 说明                                      |
| ----------------- | ------------- | ---: | ----------------------------------------- |
| id                | string / uuid |   是 | 导出任务 ID                               |
| coupleSpaceId     | string        |   是 | 所属空间                                  |
| requestedByUserId | string        |   是 | 发起用户                                  |
| status            | enum          |   是 | pending / processing / completed / failed |
| fileUrl           | string        |   否 | 导出文件地址                              |
| errorMessage      | string        |   否 | 失败原因                                  |
| createdAt         | datetime      |   是 | 创建时间                                  |
| completedAt       | datetime      |   否 | 完成时间                                  |

## 15.3 索引

```text
idx_data_export_space_created_at
idx_data_export_status
```

---

# 16. 可选表：AuditLog 审计日志

## 16.1 用途

未来用于追踪关键操作。

## 16.2 字段

| 字段          | 类型          | 必填 | 说明     |
| ------------- | ------------- | ---: | -------- |
| id            | string / uuid |   是 | 日志 ID  |
| coupleSpaceId | string        |   是 | 所属空间 |
| userId        | string        |   否 | 操作用户 |
| action        | string        |   是 | 操作类型 |
| targetType    | string        |   是 | 目标类型 |
| targetId      | string        |   否 | 目标 ID  |
| payloadJson   | json          |   否 | 操作内容 |
| createdAt     | datetime      |   是 | 创建时间 |

## 16.3 索引

```text
idx_audit_space_created_at
idx_audit_user_id
idx_audit_target
```

---

# 17. 表关系总览

```text
User
  └── Membership
        └── CoupleSpace
              ├── PartnerProfile
              ├── AppConfig
              ├── Wallet
              │     └── WalletLedger
              ├── DailyRecord
              │     ├── DailyRecordSide
              │     └── WalletLedger
              ├── ExchangeCategory
              └── ExchangeRecord
                    └── WalletLedger
```

---

# 18. 唯一约束总览

| 表               | 唯一约束                    | 说明                           |
| ---------------- | --------------------------- | ------------------------------ |
| User             | email                       | 邮箱唯一，可为空               |
| User             | phone                       | 手机号唯一，可为空             |
| Membership       | coupleSpaceId + userId      | 用户不能重复加入同一空间       |
| PartnerProfile   | coupleSpaceId + partnerKey  | 一个空间内 fish/cat 各一个     |
| AppConfig        | coupleSpaceId               | 一个空间一份配置               |
| DailyRecord      | coupleSpaceId + recordDate  | 一个空间一天一条总记录         |
| DailyRecordSide  | dailyRecordId + partnerKey  | 一天内每个角色一条             |
| Wallet           | coupleSpaceId               | 一个空间一个钱包               |
| ExchangeCategory | coupleSpaceId + title，可选 | 避免同名奖励，软删除需特殊处理 |

---

# 19. 索引总览

## 高频查询索引

```text
DailyRecord(coupleSpaceId, recordDate)
ExchangeRecord(coupleSpaceId, occurredAt)
WalletLedger(coupleSpaceId, createdAt)
ExchangeCategory(coupleSpaceId, isActive)
Membership(userId)
```

## 详情查询索引

```text
DailyRecordSide(dailyRecordId)
WalletLedger(relatedDailyRecordId)
WalletLedger(relatedExchangeRecordId)
ExchangeRecord(exchangeCategoryId)
```

## 权限查询索引

```text
Membership(coupleSpaceId, userId)
PartnerProfile(coupleSpaceId, userId)
```

---

# 20. 软删除建议

建议这些表支持软删除：

```text
DailyRecord
ExchangeRecord
ExchangeCategory
CoupleSpace
```

原因：

* 方便撤销；
* 方便审计；
* 避免误删；
* 方便未来同步冲突处理。

软删除字段：

```text
deletedAt
```

查询默认过滤：

```text
deletedAt is null
```

---

# 21. 事务设计建议

以下操作必须使用事务。

## 21.1 保存每日记录

```text
upsert DailyRecord
upsert DailyRecordSide fish
upsert DailyRecordSide cat
写入或调整 WalletLedger
更新 Wallet 快照
```

## 21.2 删除每日记录

```text
软删除 DailyRecord
软删除或冲销相关 WalletLedger
更新 Wallet 快照
```

## 21.3 兑换奖励

```text
检查 Wallet 余额
创建 ExchangeRecord
创建 WalletLedger 负数流水
更新 Wallet 快照
```

## 21.4 删除兑换记录

```text
软删除 ExchangeRecord
冲销 WalletLedger
更新 Wallet 快照
```

---

# 22. 规则变更与历史数据

如果未来支持修改宝石规则、金币规则、热力图规则，需要明确历史数据是否重算。

建议提供两种策略：

## 22.1 历史快照策略

历史记录保存当时计算结果，不随规则变化。

优点：

```text
历史稳定
用户理解简单
```

缺点：

```text
规则更新后前后数据标准不同
```

## 22.2 历史重算策略

规则变化后重算所有历史记录。

优点：

```text
规则一致
统计统一
```

缺点：

```text
用户历史资源可能变化
需要强提示
```

MVP 后端阶段建议先采用：

```text
历史快照为主，必要时提供手动重算
```

---

# 23. 数据库草案总结

未来数据库核心表建议为：

```text
User
CoupleSpace
Membership
PartnerProfile
AppConfig
DailyRecord
DailyRecordSide
Wallet
WalletLedger
ExchangeCategory
ExchangeRecord
```

最重要的事实表是：

```text
DailyRecord
DailyRecordSide
ExchangeRecord
WalletLedger
```

最重要的配置表是：

```text
AppConfig
ExchangeCategory
PartnerProfile
```

最重要的约束是：

```text
coupleSpaceId + recordDate 唯一
dailyRecordId + partnerKey 唯一
coupleSpaceId + userId 唯一
coupleSpaceId + partnerKey 唯一
```

最重要的设计原则是：

> 每日记录保存用户真实输入；奖励结果可以保存快照，但必须能被规则重新计算。
> 钱包余额可以保存快照，但资源变化应由 WalletLedger 追踪。
> 兑换记录必须保存当时的奖励快照，不能依赖当前奖励分类。
>
