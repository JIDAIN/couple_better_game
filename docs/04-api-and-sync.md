# API、云端同步与鉴权

## 1. API 总览

### 当前 production 已上线

| Method | Path | 作用 |
|---|---|---|
| POST | `/api/cloud-session` | 验证同步密码并建立 cloud session |
| GET | `/api/home-data` | 从 Supabase 导出兼容游戏快照 |
| POST | `/api/save-data` | 将兼容游戏快照写回规范化 Supabase |
| GET | `/api/meals?date=...&person=...` | 查询某日餐食 |
| POST | `/api/meals` | 新增餐食 |
| PUT | `/api/meals/[id]` | 完整更新餐食 |
| DELETE | `/api/meals/[id]` | 软删除餐食 |

### V2-P1 分支新增

| Method | Path | 作用 |
|---|---|---|
| GET | `/api/life/day?date=YYYY-MM-DD` | 一次读取当天心情、睡眠、活动 |
| PUT | `/api/life/mood` | 保存/修改当天某角色心情 |
| PUT | `/api/life/sleep` | 保存/修改当天某角色睡眠 |
| POST | `/api/life/activities` | 新增活动 |
| PUT | `/api/life/activities/[id]` | 修改活动 |
| DELETE | `/api/life/activities/[id]` | 软删除活动 |

这些 Life API 在 migration 应用并合并前不视为 production 已上线。

## 2. 当前鉴权模型

这是私人小范围应用的共享访问保护，不是完整用户账号系统。

### Web

服务器环境变量：

```text
DATA_EDIT_PASSWORD
```

验证成功后设置 HttpOnly：

```text
couple-cloud-session
```

浏览器业务路径统一保持：

```text
Browser
-> Next.js API
-> cloud request auth
-> lib/server domain service
-> service-role RPC
-> Supabase
```

Life API 复用现有 cloud session / `x-couple-password` 鉴权，不在浏览器暴露 Supabase secret。

### ChatGPT

ChatGPT 不使用浏览器共享密码，也不新增匿名写接口。

当前已上线餐食路径：

```text
ChatGPT explicit confirmation
-> 已授权 Supabase 能力
-> service-only ChatGPT meal RPC
-> meals / meal_items
```

未来 Life / Weight / Medicine 继续沿用同一原则：受授权连接 + 领域专属写接口，而不是通用 SQL 写权限。

## 3. 新设备保护

游戏兼容同步继续保留：

```text
新设备
-> 输入同步密码
-> POST /api/cloud-session
-> 建立 HttpOnly session
-> 先从云端下载
-> 再允许后续写回
```

没有 cloud session 就直接调用 `/api/save-data` 时仍受现有 guard 保护。

## 4. 游戏云端读取 / 写入

读取：

```text
GET /api/home-data
-> export_home_sync_snapshot
-> Supabase normalized tables
-> schemaVersion 1 compatible snapshot
```

写入：

```text
POST /api/save-data
-> auth / guard
-> importHomeBackupJson normalize
-> buildHomeSyncData
-> replace_home_sync_snapshot
-> Supabase
```

`reloadFromGitHub / syncToGitHub / /data/couple-data.json` 仍是 legacy 内部命名 / compatibility shim。

## 5. Meal API

### 查询

```http
GET /api/meals?date=2026-09-01&person=cat
```

### 新增 / 更新 / 删除

```text
POST   /api/meals
PUT    /api/meals/<uuid>
DELETE /api/meals/<uuid>
```

当前 source：

```text
manual / chatgpt / import
```

当前 meal kcal 仍为必填；V2-P3 再单独迁移到 nullable，保持：

```text
NULL = 未估算
0 = 确实为 0 kcal
```

## 6. Life API

### 当天读取

```http
GET /api/life/day?date=2026-09-02
```

返回 canonical shape：

```json
{
  "date": "2026-09-02",
  "moods": [],
  "sleeps": [],
  "activities": []
}
```

首页未来只需要一次读取，不需要三个模块各发一次请求。

### 心情

```http
PUT /api/life/mood
```

手动 Web payload 只需要：

```json
{
  "partnerKey": "fish",
  "moodDate": "2026-09-02",
  "moodKey": "calm"
}
```

Web route 强制 `source=manual`，不接受客户端伪造 ChatGPT source/idempotency。

### 睡眠

```http
PUT /api/life/sleep
```

保存：

```text
partnerKey
sleepDate
fellAsleepAt
wokeAt
```

`wokeAt` 必须晚于 `fellAsleepAt`。`sleepDate` 是这条睡眠记录在生活日历/首页归属的日期；时长从两个时间派生，不作为评价分数。

### 活动

```text
POST   /api/life/activities
PUT    /api/life/activities/<uuid>
DELETE /api/life/activities/<uuid>
```

手动 UI 核心只需要 `activityDate + text`，默认 `participantScope=both`。

以下字段是可选结构化信息，不要求用户每次填写：

```text
occurredAt
activityType
durationMinutes
```

未来 AI 可在事实明确时补充这些字段。

## 7. Life RPC 映射

| 调用方 | RPC |
|---|---|
| Life day read | `get_life_day` |
| Mood write | `upsert_mood_record` |
| Sleep write | `upsert_sleep_record` |
| Activity create | `create_activity_record` |
| Activity update | `update_activity_record` |
| Activity delete | `delete_activity_record` |

这些函数只授权 service-role 路径；`anon / authenticated` 不获得 execute 权限。

## 8. AI 写入统一协议

V2 不再把 AI 理解成“饮食专属功能”。

代码基础：

```text
lib/ai/record-write-protocol.ts
```

当前预留 AI writable domains：

```text
meal
mood
sleep
activity
weight
medicine
```

统一流程：

```text
自然语言 / 图片
-> 对话层解析草稿
-> 用户明确确认保存或修改
-> buildChatgptWriteIdempotencyKey(...)
-> domain-specific prepare / validation
-> domain-specific canonical write service / restricted RPC
-> read-back / receipt check
-> 成功后确认
```

关键点：

- “理解了用户的话”不等于“获得写数据库权限”；
- 不提供 `execute arbitrary SQL` 风格的统一 AI 工具；
- 通用层只负责 domain/source/idempotency 等横切能力；
- 具体字段和业务规则继续属于各领域；
- 工具超时或结果不确定时必须查回执/读回，再用同一个 key 重试。

## 9. `record_write_receipts`

V2-P1 新增跨领域外部写入回执表：

```text
couple_space_id
source          chatgpt / import
domain          meal / mood / sleep / activity / weight / medicine
idempotency_key
entity_id
created_at
```

作用：

1. 外部写入重试不会因为实体后来被手动编辑而丢失幂等历史；
2. AI/导入可以按稳定 key 查“这次确认是否已经执行”；
3. 将来药箱、体重、心情不需要各自重新发明一套重试机制。

现有 meal 自身已经有 `meals.idempotency_key`，当前不强行迁移；以后可以逐步桥接到统一 receipt 机制。

## 10. ChatGPT 餐食“记上”现状

当前已上线路径仍保持：

```text
明确保存意图
-> 构造最终 meal payload
-> chatgpt: idempotency key
-> create_chatgpt_meal_record
-> meals + meal_items
-> get_chatgpt_meal_record(same key)
-> 成功后回复“已记上”
```

ChatGPT 餐食写入不得直接修改 deficit、exercise、weight、wallet、金币宝石或 heatmap。

## 11. P2.5 同日关联

P2.5 是只读关联，不新增数据库写行为。

代码已在 V2-P0 拆成：

```text
DailyMealsPanel        legacy game adapter
└─ DailyMealsPanelCore provider-free nutrition UI
```

因此未来独立饮食页不需要 `HomeResourcesProvider`。

## 12. 当前安全边界

- 浏览器数据 API 验证共享 password/session；
- Supabase secret 不进入浏览器或普通聊天；
- API 响应使用 `no-store`；
- server-only RPC 不授权 anon/authenticated；
- ChatGPT 只在明确确认后调用受限领域写接口；
- 外部写入使用稳定 idempotency key；
- 当前仍是共享空间保护，不是成熟单用户授权模型。
