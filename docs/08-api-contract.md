
# API 接口契约文档：双人变美变瘦大作战

# 1. 文档目的

本文档定义未来接入后端后，前端与后端之间的 API 契约，包括：

* 前端如何请求后端；
* 后端需要提供哪些接口；
* 每个接口接收什么参数；
* 每个接口返回什么数据；
* 错误格式如何统一；
* 哪些结果由后端最终确认。

当前项目中的核心数据模型包括 `DailyRecord`、`ExchangeRecord`、`ExchangeCategory`、`Wallet`、`UserRuntimeData`、`AppConfigData` 和 `AppDataSnapshot` 等。

---

# 2. 通用约定

## 2.1 Base URL

```http
/api
```

示例：

```http
GET /api/home/snapshot
POST /api/daily-records
POST /api/exchanges
```

---

## 2.2 请求格式

除文件上传、导入导出外，默认使用 JSON。

```http
Content-Type: application/json
```

未来接入登录后，请求头建议携带：

```http
Authorization: Bearer <token>
```

---

## 2.3 成功响应格式

```ts
type ApiSuccess<T> = {
  ok: true;
  data: T;
  meta?: {
    requestId?: string;
    serverTime?: string;
  };
};
```

示例：

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "serverTime": "2026-05-15T10:00:00.000Z"
  }
}
```

---

## 2.4 错误响应格式

```ts
type ApiErrorResponse = {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    fields?: Record<string, string>;
  };
  meta?: {
    requestId?: string;
    serverTime?: string;
  };
};
```

示例：

```json
{
  "ok": false,
  "error": {
    "code": "FUTURE_DATE",
    "message": "不能记录未来日期",
    "fields": {
      "recordDate": "只能选择今天或过去日期"
    }
  }
}
```

---

## 2.5 通用错误码

```ts
type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "INVALID_DATE"
  | "FUTURE_DATE"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INSUFFICIENT_BALANCE"
  | "INVALID_RESOURCE_KIND"
  | "INVALID_PRICE"
  | "SERVER_ERROR";
```

| 错误码                | 含义             |
| --------------------- | ---------------- |
| UNAUTHORIZED          | 未登录           |
| FORBIDDEN             | 无权限           |
| VALIDATION_ERROR      | 参数校验失败     |
| INVALID_DATE          | 日期不合法       |
| FUTURE_DATE           | 未来日期不可操作 |
| NOT_FOUND             | 目标资源不存在   |
| CONFLICT              | 数据冲突         |
| INSUFFICIENT_BALANCE  | 宝石或金币不足   |
| INVALID_RESOURCE_KIND | 资源类型错误     |
| INVALID_PRICE         | 价格错误         |
| SERVER_ERROR          | 服务端异常       |

---

# 3. 核心原则

## 3.1 前端只提交原始输入

前端提交每日记录时，只传：

```text
recordDate
fish.weightKg
fish.deficit
fish.minutes
cat.weightKg
cat.deficit
cat.minutes
```

不要传最终结算结果作为可信数据。

---

## 3.2 后端必须重新计算

后端必须重新计算并最终确认：

```text
fish.gems
cat.gems
bonus
coins
fishHeat
catHeat
wallet
weekGemTotal
weekCoinTotal
streakDays
```

这些字段虽然存在于当前前端数据模型中，但未来不能信任前端提交值。每日记录结构中确实包含 `fish.gems`、`cat.gems`、`bonus`、`coins`、`fishHeat`、`catHeat` 等结算结果字段。

---

## 3.3 前端可以预览

前端可以本地预览：

```text
预计宝石
预计金币
预计 bonus
预计热力图状态
兑换按钮是否可点
```

但保存时以后端返回结果为准。

---

# 4. 数据对象摘要

## 4.1 DailyRecord

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

## 4.2 DailyRecordSide

```ts
type DailyRecordSide = {
  weightKg: number | null;
  deficit: number;
  minutes: number;
  gems: number;
};
```

## 4.3 ExchangeRecord

```ts
type ExchangeRecord = {
  id: string;
  date: string;
  createdAt: string;
  occurredAt: string;
  time: string;
  category: string;
  remark: string;
  resourceKind: "gem" | "coin";
  price: number;
  icon: string;
};
```

## 4.4 ExchangeCategory

```ts
type ExchangeCategory = {
  id: string;
  title: string;
  icon: string;
  description: string;
  resourceKind: "gem" | "coin";
  price: number;
};
```

## 4.5 Wallet

```ts
type Wallet = {
  gems: number;
  coins: number;
};
```

---

# 5. 首页数据快照接口

## 5.1 获取首页完整快照

### 接口名称

获取首页完整数据快照

### 请求方法

```http
GET
```

### URL

```http
/api/home/snapshot
```

### 作用

获取首页需要的完整数据，包括运行数据和配置数据。可用于应用初始化、刷新页面、重新同步数据。

### 权限要求

需要登录。
当前 Web MVP 可不做登录，未来接入账号后必须校验用户所属情侣空间。

### 请求参数

无。

### 响应格式

```ts
type HomeSnapshotResponse = {
  version: 1;
  runtime: Partial<UserRuntimeData>;
  config: Partial<AppConfigData>;
};
```

其中：

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

```ts
type AppConfigData = {
  heatmapStartDate: string;
  coinRules: CoinRulesConfig;
  visualRules: SettlementVisualRules;
  exchangeCategories: ExchangeCategory[];
};
```

当前项目的 `AppDataSnapshot` 已经由 `version`、`runtime`、`config` 三部分组成。

### 响应示例

```json
{
  "ok": true,
  "data": {
    "version": 1,
    "runtime": {
      "wallet": {
        "gems": 39,
        "coins": 4
      },
      "dailyRecords": [],
      "exchangeRecords": []
    },
    "config": {
      "heatmapStartDate": "2026-05-01",
      "exchangeCategories": []
    }
  }
}
```

### 错误码

| 错误码       | 场景               |
| ------------ | ------------------ |
| UNAUTHORIZED | 用户未登录         |
| FORBIDDEN    | 用户无权访问该空间 |
| SERVER_ERROR | 服务端异常         |

---

# 6. 每日记录接口

## 6.1 保存某一天记录

### 接口名称

保存每日记录

### 请求方法

```http
POST
```

### URL

```http
/api/daily-records
```

### 作用

新增或更新某一天的双人记录。
如果该日期已有记录，则更新；如果没有，则新增。

### 权限要求

需要登录；用户必须属于当前情侣空间。

### 请求参数

```ts
type SaveDailyRecordRequest = {
  recordDate: string;
  fish: {
    weightKg: number | null;
    deficit: number;
    minutes: number;
  };
  cat: {
    weightKg: number | null;
    deficit: number;
    minutes: number;
  };
};
```

### 请求示例

```json
{
  "recordDate": "2026-05-14",
  "fish": {
    "weightKg": 70.5,
    "deficit": 317,
    "minutes": 0
  },
  "cat": {
    "weightKg": 60.2,
    "deficit": 244,
    "minutes": 0
  }
}
```

### 后端行为

后端必须：

1. 校验用户权限；
2. 校验日期；
3. 禁止未来日期；
4. 校验体重、热量缺口、运动分钟；
5. 查找是否已有同日记录；
6. 根据规则重新计算宝石、金币、bonus、热力图；
7. 写入每日记录；
8. 更新钱包或钱包流水；
9. 回算统计；
10. 返回最终确认结果。

### 响应格式

```ts
type SaveDailyRecordResponse = {
  record: DailyRecord;
  wallet: Wallet;
  stats: {
    weekGemTotal: number;
    weekCoinTotal: number;
    weeklySuccessDays: number;
    cumulativeSuccessDays: number;
  };
  snapshot?: AppDataSnapshot;
};
```

### 响应示例

```json
{
  "ok": true,
  "data": {
    "record": {
      "id": "daily_xxx",
      "recordDate": "2026-05-14",
      "date": "5月14日",
      "createdAt": "2026-05-14T12:00:00.000Z",
      "day": 14,
      "fish": {
        "weightKg": 70.5,
        "deficit": 317,
        "minutes": 0,
        "gems": 3
      },
      "cat": {
        "weightKg": 60.2,
        "deficit": 244,
        "minutes": 0,
        "gems": 3
      },
      "bonus": 0,
      "coins": 2,
      "fishHeat": {
        "level": "good",
        "exercise": "none"
      },
      "catHeat": {
        "level": "good",
        "exercise": "none"
      }
    },
    "wallet": {
      "gems": 49,
      "coins": 4
    },
    "stats": {
      "weekGemTotal": 30,
      "weekCoinTotal": 2,
      "weeklySuccessDays": 4,
      "cumulativeSuccessDays": 9
    }
  }
}
```

### 错误码

| 错误码           | 场景         |
| ---------------- | ------------ |
| UNAUTHORIZED     | 未登录       |
| FORBIDDEN        | 无权限       |
| VALIDATION_ERROR | 字段校验失败 |
| INVALID_DATE     | 日期格式错误 |
| FUTURE_DATE      | 未来日期     |
| CONFLICT         | 同步冲突     |
| SERVER_ERROR     | 服务端异常   |

---

## 6.2 获取某月每日记录

### 接口名称

获取成长日志列表

### 请求方法

```http
GET
```

### URL

```http
/api/daily-records
```

### 作用

按月份获取每日记录摘要，用于成长日志列表。

### 请求参数

Query：

```ts
type GetDailyRecordsQuery = {
  month: string; // YYYY-MM
};
```

### 请求示例

```http
GET /api/daily-records?month=2026-05
```

### 响应格式

```ts
type DailyRecordSummary = {
  id: string;
  recordDate: string;
  gems: number;
  coins: number;
};

type GetDailyRecordsResponse = {
  month: string;
  records: DailyRecordSummary[];
};
```

### 响应示例

```json
{
  "ok": true,
  "data": {
    "month": "2026-05",
    "records": [
      {
        "id": "daily_xxx",
        "recordDate": "2026-05-14",
        "gems": 6,
        "coins": 2
      }
    ]
  }
}
```

### 错误码

| 错误码           | 场景           |
| ---------------- | -------------- |
| VALIDATION_ERROR | month 格式错误 |
| UNAUTHORIZED     | 未登录         |
| FORBIDDEN        | 无权限         |

---

## 6.3 获取每日记录详情

### 接口名称

获取每日记录详情

### 请求方法

```http
GET
```

### URL

```http
/api/daily-records/:recordId
```

### 作用

获取某一天完整记录，用于记录详情弹窗。

### 请求参数

Path：

```text
recordId
```

### 响应格式

```ts
type DailyRecordDetailResponse = {
  record: DailyRecord;
  breakdown: {
    fish: {
      gems: number;
      lines: string[];
    };
    cat: {
      gems: number;
      lines: string[];
    };
    coupleBonus: {
      gems: number;
      label: string;
    };
    coin: {
      delta: number;
      hint: string;
    };
  };
};
```

### 响应示例

```json
{
  "ok": true,
  "data": {
    "record": {
      "id": "daily_xxx",
      "recordDate": "2026-05-14",
      "fish": {
        "weightKg": 70.5,
        "deficit": 317,
        "minutes": 0,
        "gems": 3
      },
      "cat": {
        "weightKg": 60.2,
        "deficit": 244,
        "minutes": 0,
        "gems": 3
      },
      "bonus": 0,
      "coins": 2,
      "fishHeat": {
        "level": "good",
        "exercise": "none"
      },
      "catHeat": {
        "level": "good",
        "exercise": "none"
      }
    },
    "breakdown": {
      "fish": {
        "gems": 3,
        "lines": ["缺口 +2", "恢复 +1"]
      },
      "cat": {
        "gems": 3,
        "lines": ["缺口 +2", "恢复 +1"]
      },
      "coupleBonus": {
        "gems": 0,
        "label": "未点亮"
      },
      "coin": {
        "delta": 2,
        "hint": "本周达标 · 连续坚持"
      }
    }
  }
}
```

### 错误码

| 错误码       | 场景       |
| ------------ | ---------- |
| NOT_FOUND    | 记录不存在 |
| FORBIDDEN    | 无权限     |
| UNAUTHORIZED | 未登录     |

---

## 6.4 删除每日记录

### 接口名称

删除每日记录

### 请求方法

```http
DELETE
```

### URL

```http
/api/daily-records/:recordId
```

### 作用

删除某一天的记录，并回算钱包、热力图和统计。

### 响应格式

```ts
type DeleteDailyRecordResponse = {
  deleted: true;
  wallet: Wallet;
  stats: {
    weekGemTotal: number;
    weekCoinTotal: number;
    weeklySuccessDays: number;
    cumulativeSuccessDays: number;
  };
  snapshot?: AppDataSnapshot;
};
```

### 错误码

| 错误码       | 场景         |
| ------------ | ------------ |
| NOT_FOUND    | 记录不存在   |
| FORBIDDEN    | 无权限       |
| CONFLICT     | 数据版本冲突 |
| SERVER_ERROR | 删除失败     |

---

# 7. 成长地图接口

## 7.1 获取成长地图数据

### 接口名称

获取成长地图

### 请求方法

```http
GET
```

### URL

```http
/api/heatmap
```

### 请求参数

Query：

```ts
type GetHeatmapQuery = {
  month: string; // YYYY-MM
};
```

### 响应格式

```ts
type GetHeatmapResponse = {
  month: string;
  heatmapStartDate: string;
  fish: Record<string, HeatmapDay>;
  cat: Record<string, HeatmapDay>;
  weeklySuccessDays: number;
};
```

### 响应示例

```json
{
  "ok": true,
  "data": {
    "month": "2026-05",
    "heatmapStartDate": "2026-05-01",
    "fish": {
      "2026-05-14": {
        "level": "good",
        "exercise": "none"
      }
    },
    "cat": {
      "2026-05-14": {
        "level": "good",
        "exercise": "none"
      }
    },
    "weeklySuccessDays": 4
  }
}
```

### 错误码

| 错误码           | 场景           |
| ---------------- | -------------- |
| VALIDATION_ERROR | month 格式错误 |
| UNAUTHORIZED     | 未登录         |
| FORBIDDEN        | 无权限         |

---

## 7.2 更新热力图起始日

### 接口名称

更新作战开始日

### 请求方法

```http
PATCH
```

### URL

```http
/api/config/heatmap-start-date
```

### 请求参数

```ts
type UpdateHeatmapStartDateRequest = {
  heatmapStartDate: string; // YYYY-MM-DD
};
```

### 响应格式

```ts
type UpdateHeatmapStartDateResponse = {
  heatmapStartDate: string;
  snapshot?: AppDataSnapshot;
};
```

### 错误码

| 错误码           | 场景         |
| ---------------- | ------------ |
| INVALID_DATE     | 日期格式错误 |
| VALIDATION_ERROR | 参数错误     |
| FORBIDDEN        | 无权限       |

---

# 8. 兑换商店接口

## 8.1 获取兑换商店数据

### 接口名称

获取兑换商店

### 请求方法

```http
GET
```

### URL

```http
/api/exchange-shop
```

### 作用

获取兑换商店需要的数据，包括钱包、奖励分类和最近兑换记录。

### 响应格式

```ts
type GetExchangeShopResponse = {
  wallet: Wallet;
  categories: ExchangeCategory[];
  recentRecords: ExchangeRecord[];
};
```

### 响应示例

```json
{
  "ok": true,
  "data": {
    "wallet": {
      "gems": 49,
      "coins": 4
    },
    "categories": [
      {
        "id": "snack",
        "title": "零食",
        "icon": "🍪",
        "description": "轻轻松松来一点",
        "resourceKind": "gem",
        "price": 5
      }
    ],
    "recentRecords": []
  }
}
```

---

## 8.2 兑换奖励

### 接口名称

兑换奖励

### 请求方法

```http
POST
```

### URL

```http
/api/exchanges
```

### 请求参数

```ts
type RedeemExchangeRequest = {
  categoryId: string;
  remark?: string;
  occurredAt?: string;
};
```

### 请求示例

```json
{
  "categoryId": "family",
  "remark": "赛百味",
  "occurredAt": "2026-05-14T20:30:00.000Z"
}
```

### 后端行为

后端必须：

1. 校验用户权限；
2. 查询奖励类别；
3. 校验资源是否足够；
4. 扣除宝石或金币；
5. 创建兑换记录；
6. 写入钱包流水或更新钱包；
7. 返回最终钱包和兑换记录。

### 响应格式

```ts
type RedeemExchangeResponse = {
  record: ExchangeRecord;
  wallet: Wallet;
  snapshot?: AppDataSnapshot;
};
```

### 错误码

| 错误码                | 场景           |
| --------------------- | -------------- |
| NOT_FOUND             | 奖励类别不存在 |
| INSUFFICIENT_BALANCE  | 资源不足       |
| INVALID_RESOURCE_KIND | 资源类型错误   |
| INVALID_PRICE         | 价格错误       |
| FORBIDDEN             | 无权限         |

---

## 8.3 获取兑换记录

### 接口名称

获取兑换记录

### 请求方法

```http
GET
```

### URL

```http
/api/exchanges
```

### 请求参数

Query：

```ts
type GetExchangeRecordsQuery = {
  limit?: number;
  page?: number;
};
```

### 响应格式

```ts
type GetExchangeRecordsResponse = {
  records: ExchangeRecord[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
};
```

---

## 8.4 编辑兑换记录

### 接口名称

编辑兑换记录

### 请求方法

```http
PATCH
```

### URL

```http
/api/exchanges/:exchangeRecordId
```

### 请求参数

```ts
type UpdateExchangeRecordRequest = {
  remark?: string;
  occurredAt?: string;
};
```

### 响应格式

```ts
type UpdateExchangeRecordResponse = {
  record: ExchangeRecord;
};
```

### 错误码

| 错误码           | 场景           |
| ---------------- | -------------- |
| NOT_FOUND        | 兑换记录不存在 |
| FORBIDDEN        | 无权限         |
| VALIDATION_ERROR | 字段错误       |

---

## 8.5 删除兑换记录

### 接口名称

删除兑换记录

### 请求方法

```http
DELETE
```

### URL

```http
/api/exchanges/:exchangeRecordId
```

### 作用

删除兑换记录，并回退或重算对应资源。

### 响应格式

```ts
type DeleteExchangeRecordResponse = {
  deleted: true;
  wallet: Wallet;
  snapshot?: AppDataSnapshot;
};
```

### 错误码

| 错误码    | 场景           |
| --------- | -------------- |
| NOT_FOUND | 兑换记录不存在 |
| FORBIDDEN | 无权限         |
| CONFLICT  | 数据冲突       |

---

# 9. 奖励分类接口

## 9.1 新增奖励分类

### 接口名称

新增奖励分类

### 请求方法

```http
POST
```

### URL

```http
/api/exchange-categories
```

### 请求参数

```ts
type CreateExchangeCategoryRequest = {
  title: string;
  icon: string;
  description: string;
  resourceKind: ResourceKind;
  price: number;
};
```

### 响应格式

```ts
type CreateExchangeCategoryResponse = {
  category: ExchangeCategory;
  categories: ExchangeCategory[];
};
```

### 错误码

| 错误码                | 场景           |
| --------------------- | -------------- |
| VALIDATION_ERROR      | 字段缺失或无效 |
| INVALID_RESOURCE_KIND | 资源类型错误   |
| INVALID_PRICE         | 价格错误       |

---

## 9.2 编辑奖励分类

### 接口名称

编辑奖励分类

### 请求方法

```http
PATCH
```

### URL

```http
/api/exchange-categories/:categoryId
```

### 请求参数

```ts
type UpdateExchangeCategoryRequest = Partial<{
  title: string;
  icon: string;
  description: string;
  resourceKind: ResourceKind;
  price: number;
}>;
```

### 响应格式

```ts
type UpdateExchangeCategoryResponse = {
  category: ExchangeCategory;
  categories: ExchangeCategory[];
};
```

---

## 9.3 删除奖励分类

### 接口名称

删除奖励分类

### 请求方法

```http
DELETE
```

### URL

```http
/api/exchange-categories/:categoryId
```

### 响应格式

```ts
type DeleteExchangeCategoryResponse = {
  deleted: true;
  categories: ExchangeCategory[];
};
```

### 说明

删除奖励分类不应影响历史兑换记录。
历史兑换记录应保留兑换当时的名称、图标、价格和资源类型快照。

---

# 10. 配置接口

## 10.1 获取配置

### 接口名称

获取应用配置

### 请求方法

```http
GET
```

### URL

```http
/api/config
```

### 响应格式

```ts
type GetConfigResponse = AppConfigData;
```

---

## 10.2 更新金币规则

### 接口名称

更新金币规则

### 请求方法

```http
PATCH
```

### URL

```http
/api/config/coin-rules
```

### 请求参数

```ts
type UpdateCoinRulesRequest = {
  weekStartDay: number;
  deficitStreakDays: number;
};
```

### 响应格式

```ts
type UpdateCoinRulesResponse = {
  coinRules: CoinRulesConfig;
  snapshot?: AppDataSnapshot;
};
```

### 说明

规则变更后，后端应明确是否重算历史数据。

---

## 10.3 更新视觉规则

### 接口名称

更新热力图视觉规则

### 请求方法

```http
PATCH
```

### URL

```http
/api/config/visual-rules
```

### 请求参数

```ts
type UpdateVisualRulesRequest = SettlementVisualRules;
```

### 响应格式

```ts
type UpdateVisualRulesResponse = {
  visualRules: SettlementVisualRules;
  snapshot?: AppDataSnapshot;
};
```

---

# 11. 数据导入导出接口，未来

## 11.1 导出数据

### 接口名称

导出用户数据

### 请求方法

```http
GET
```

### URL

```http
/api/export
```

### 响应格式

```ts
type ExportResponse = AppDataSnapshot;
```

---

## 11.2 导入数据

### 接口名称

导入用户数据

### 请求方法

```http
POST
```

### URL

```http
/api/import
```

### 请求参数

```ts
type ImportRequest = {
  snapshot: AppDataSnapshot;
  mode: "replace" | "merge";
};
```

### 响应格式

```ts
type ImportResponse = {
  snapshot: AppDataSnapshot;
};
```

### 错误码

| 错误码           | 场景         |
| ---------------- | ------------ |
| VALIDATION_ERROR | 快照格式错误 |
| CONFLICT         | 合并冲突     |
| SERVER_ERROR     | 导入失败     |

---

# 12. 登录与空间接口，未来

## 12.1 获取当前用户

```http
GET /api/me
```

响应：

```ts
type MeResponse = {
  user: {
    id: string;
    nickname: string;
  };
  currentSpace?: {
    id: string;
    name: string;
  };
};
```

---

## 12.2 获取情侣空间

```http
GET /api/couple-space
```

响应：

```ts
type CoupleSpaceResponse = {
  id: string;
  name: string;
  partners: Array<{
    id: string;
    personKey: "fish" | "cat";
    nickname: string;
    emoji: string;
  }>;
};
```

---

# 13. API 权限总结

| 接口                                 | 是否需要登录 | 权限要求             |
| ------------------------------------ | -----------: | -------------------- |
| GET /api/home/snapshot               |           是 | 当前用户属于空间     |
| POST /api/daily-records              |           是 | 可编辑空间记录       |
| GET /api/daily-records               |           是 | 可查看空间记录       |
| GET /api/daily-records/:id           |           是 | 可查看该记录         |
| DELETE /api/daily-records/:id        |           是 | 可删除该记录         |
| GET /api/heatmap                     |           是 | 可查看空间记录       |
| PATCH /api/config/heatmap-start-date |           是 | 可修改空间配置       |
| GET /api/exchange-shop               |           是 | 可查看空间商店       |
| POST /api/exchanges                  |           是 | 可兑换奖励           |
| GET /api/exchanges                   |           是 | 可查看兑换记录       |
| PATCH /api/exchanges/:id             |           是 | 可编辑兑换记录       |
| DELETE /api/exchanges/:id            |           是 | 可删除兑换记录       |
| POST /api/exchange-categories        |           是 | 可管理奖励类别       |
| PATCH /api/exchange-categories/:id   |           是 | 可管理奖励类别       |
| DELETE /api/exchange-categories/:id  |           是 | 可管理奖励类别       |
| GET /api/export                      |           是 | 可导出自己的空间数据 |
| POST /api/import                     |           是 | 可导入自己的空间数据 |

---

# 14. 前端调用策略

## 14.1 推荐前端封装

未来可以新增：

```text
lib/home/remote-app-data-store.ts
lib/home/api-client.ts
```

前端组件不直接 `fetch`，而是：

```text
UI → Provider → Remote AppDataStore / API Client → API
```

---

## 14.2 请求失败处理

前端收到错误后：

| 错误码               | 前端行为                |
| -------------------- | ----------------------- |
| UNAUTHORIZED         | 跳转登录                |
| FORBIDDEN            | 显示无权限提示          |
| VALIDATION_ERROR     | 标记表单字段            |
| FUTURE_DATE          | toast：只能记到今天哦   |
| INSUFFICIENT_BALANCE | toast：还差一点点       |
| NOT_FOUND            | toast：这条记录没有找到 |
| CONFLICT             | 提示刷新                |
| SERVER_ERROR         | toast：稍后再试         |

---

# 15. 关键接口完成标准

API 契约可认为完成，当满足：

1. 前端可以获取完整首页数据；
2. 前端可以保存某一天记录；
3. 后端返回最终结算后的记录和钱包；
4. 前端可以按月份获取成长日志；
5. 前端可以查看记录详情；
6. 前端可以删除记录；
7. 前端可以获取成长地图；
8. 前端可以兑换奖励；
9. 前端可以查看、编辑、删除兑换记录；
10. 前端可以管理奖励分类；
11. 所有错误返回格式统一；
12. 后端不信任前端传来的宝石、金币和钱包结果。

---

# 16. 总结

API 设计的核心边界是：

```text
前端提交原始输入；
后端重新计算结果；
数据库保存事实数据；
API 返回最终状态。
```

最重要的接口是：

```text
GET /api/home/snapshot
POST /api/daily-records
GET /api/daily-records
GET /api/daily-records/:id
DELETE /api/daily-records/:id
GET /api/exchange-shop
POST /api/exchanges
GET /api/exchanges
PATCH /api/exchanges/:id
DELETE /api/exchanges/:id
```

当前 Web MVP 可以继续使用本地存储。未来接入后端时，应优先以这些 API 契约替换 `AppDataStore` 的数据来源。
