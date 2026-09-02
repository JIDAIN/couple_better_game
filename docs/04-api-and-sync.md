# API、云端同步与鉴权

## 1. 当前 API 总览

| Method | Path | 作用 | 当前状态 |
|---|---|---|---|
| POST | `/api/cloud-session` | 首次验证同步密码并建立 cloud session | 已上线 |
| GET | `/api/home-data` | 从 Supabase 导出兼容游戏快照 | 已上线 |
| POST | `/api/save-data` | 将兼容游戏快照写回规范化 Supabase | 已上线 |
| GET | `/api/meals?date=...&person=...` | 查询某日餐食 | 已上线 |
| POST | `/api/meals` | 新增餐食 | 已上线 |
| PUT | `/api/meals/[id]` | 完整更新餐食 | 已上线 |
| DELETE | `/api/meals/[id]` | 软删除餐食 | 已上线 |

旧文档中的 `/api/home/snapshot`、`/api/daily-records`、`/api/exchanges` 等只是曾经的未来草案，当前不存在。

ChatGPT “记上”不是浏览器 API：当前由**已授权的 Supabase 连接能力**调用 service-only RPC，不向聊天或浏览器暴露 Supabase secret。

## 2. 当前鉴权模型

这是私人小范围应用的共享访问保护，不是完整用户登录。

### 同步密码

服务器环境变量：

```text
DATA_EDIT_PASSWORD
```

验证在服务端进行。

### Cloud session

验证成功后服务器设置：

```text
couple-cloud-session
```

Cookie 属性：

- HttpOnly
- production Secure
- SameSite=Lax
- Path=/
- max age 90 days

Cookie 不保存原始同步密码。

### API 请求认证

`/api/home-data` 和 meal API 可以通过：

- 有效 cloud session；或
- `x-couple-password` 请求头中的正确同步密码

`/api/save-data` 当前 request body 仍显式包含 `password`，并额外要求已建立 cloud session 才允许真正写入。

### ChatGPT 连接认证

ChatGPT P2 不复制 `DATA_EDIT_PASSWORD` 或 `SUPABASE_SECRET_KEY` 到对话中，也不新增匿名写接口。

当前路径是：

```text
ChatGPT conversation
-> 已连接并获用户授权的 Supabase 能力
-> service-only ChatGPT meal RPC
-> existing create_meal_record transaction RPC
-> meals + meal_items
```

`anon` / `authenticated` 不获得这些 RPC 的 execute 权限。

## 3. 首次连接流程

```text
新设备
-> DataManagement 输入同步密码
-> POST /api/cloud-session
-> 服务端验证
-> Set-Cookie cloud session
-> 从云端重新加载
-> Supabase snapshot -> 本地缓存
```

如果新设备跳过下载，直接调用 `/api/save-data`：

```text
password 正确
cloud session 不存在
-> 409 CLOUD_SESSION_REQUIRED
-> 发 cookie
-> 本次不写云端
```

这是必须保留的防覆盖机制。

## 4. 游戏读取

### `GET /api/home-data`

成功返回的是兼容 snapshot 本身，不包一层 `data`：

```json
{
  "schemaVersion": 1,
  "updatedAt": "...",
  "wallet": {},
  "dailyRecords": [],
  "exchangeRecords": []
}
```

响应头包括：

```text
Cache-Control: no-store
X-Couple-Data-Source: supabase
```

数据来自 RPC：

```text
export_home_sync_snapshot
```

## 5. 游戏写入

### `POST /api/save-data`

请求：

```json
{
  "password": "<user input>",
  "data": { "schemaVersion": 1 }
}
```

服务端流程：

1. 校验环境和 password；
2. 验证 cloud session；
3. `importHomeBackupJson()` 规范化 / legacy migration；
4. `buildHomeSyncData()` 生成 canonical compatibility snapshot；
5. RPC `replace_home_sync_snapshot` 写入规范化表；
6. 返回新的 `updatedAt`。

成功：

```json
{ "ok": true, "updatedAt": "..." }
```

典型错误：

```text
400 BAD_REQUEST / INVALID_DATA
401 WRONG_PASSWORD
409 CLOUD_SESSION_REQUIRED
500 SERVER_CONFIG
502 CLOUD_READ_FAILED / CLOUD_WRITE_FAILED / CLOUD_NETWORK_ERROR
```

## 6. 为什么 Provider 还请求 `/data/couple-data.json`

这是迁移兼容层。

当前 Provider 内部仍有：

```text
reloadFromGitHub
syncToGitHub
/data/couple-data.json
```

真实行为是：

```text
/data/couple-data.json
-> proxy.ts
-> 验证 couple-cloud-session
-> rewrite /api/home-data
-> Supabase
```

当前 GitHub 仓库中已经没有公开 `public/data/couple-data.json`。

因此：

- 内部名称是 legacy；
- 用户界面已经显示“云端”；
- 数据源是 Supabase；
- 完成调用方迁移后才能安全移除 shim。

## 7. 本地覆盖保护

`guardRemoteReload()` 会在以下情况阻止自动覆盖：

- 本地有未同步修改；
- 本地有数据，但没有 last synced metadata。

用户可以显式确认“覆盖本地并重新加载”。

## 8. Meal API

### 查询

```http
GET /api/meals?date=2026-09-01&person=fish
```

- `date` 必填，合法 `YYYY-MM-DD`；
- `person` 可选，fish/cat。

响应：

```json
{ "ok": true, "meals": [] }
```

### 新增

```http
POST /api/meals
Content-Type: application/json
```

示例：

```json
{
  "partnerKey": "fish",
  "mealDate": "2026-09-01",
  "mealType": "lunch",
  "eatenAt": "2026-09-01T12:30:00+08:00",
  "source": "manual",
  "items": [
    {
      "rawName": "米饭",
      "portionDescription": "一小碗",
      "caloriesKcal": 180,
      "calorieMinKcal": 160,
      "calorieMaxKcal": 200
    }
  ]
}
```

如果没有显式 meal total，校验层可以从 items 求和。区间只有在可完整推导时自动求和。

成功状态 201：

```json
{ "ok": true, "meal": {} }
```

### 更新

```http
PUT /api/meals/<uuid>
```

当前语义是**完整 meal payload 替换**，不是 PATCH。事务 RPC 更新 meal 后重建 items。

### 删除

```http
DELETE /api/meals/<uuid>
```

当前是 soft delete：设置 `deleted_at`，普通 list 不再返回。

### Meal source

```text
manual
chatgpt
import
```

ChatGPT 只有用户明确“记上”后才应提交 `source=chatgpt`。

## 9. Meal 参数约束

- 单餐最多 50 item；
- kcal 为非负整数；
- weight/macros 为非负数；
- `min <= estimate <= max`；
- `snack_period` 只用于 snack；
- note 最长 2000；
- idempotencyKey 最长 200；
- foodId 如存在必须为 UUID；
- rawName 必须存在。

## 10. ChatGPT “记上”持久化协议

### 10.1 确认边界

```text
讨论 / 看图 / 估算 / 用户修正
!= 数据库写入
```

只有用户明确表达“记上”“把这餐记下来”或语义等价的**保存意图**后，才进入持久化步骤。

仅仅说：

```text
“其实米饭只有半碗”
“热量再算低一点”
“那大概是多少”
```

都只是在修改当前草稿，不产生写入。

已经成功写入后，如果用户只是补充事实，也不自动覆盖数据库；需要明确表达“改一下刚才那餐”“把记录改成……”等更新意图。当前 P2 首版的自动持久化入口负责新增；已保存餐食也可继续通过 Web UI 编辑/删除。

### 10.2 角色映射

当前约定：

```text
用户自己的饮食聊天 -> cat（猫猫）
鱼鱼的饮食聊天     -> fish（鱼鱼）
```

如果上下文无法可靠判断角色，不允许猜测后写入。用户在当前对话中明确说明角色时，以当前明确说明为最高优先级。

### 10.3 创建步骤

明确确认后：

1. 以最终确认过的食物、份量、热量估算构造 meal payload；
2. 至少保留一个 `meal_item`，并保留用户原始食物名称到 `rawName`；
3. 生成一次性但可重试的 `chatgpt:` 幂等键；
4. 调用 `create_chatgpt_meal_record`；
5. RPC 强制 `source=chatgpt`、`status=confirmed`；
6. RPC 重新汇总 item kcal，整餐中心值必须与 item 之和一致；
7. 使用同一幂等键调用 `get_chatgpt_meal_record` 做读回确认；
8. 成功后再告诉用户“已记上”。

### 10.4 幂等键

推荐格式：

```text
chatgpt:<partnerKey>:<mealDate>:<confirmationNonce>
```

例如：

```text
chatgpt:cat:2026-09-02:20260902T122030-a1b2c3
```

要求：

- 以 `chatgpt:` 开头；
- 最长 200 字符；
- 一次明确确认生成一个 key；
- 网络错误或结果不确定时，**必须复用原 key**，不能生成新 key 重试；
- 用户明确表示“再记一顿”时才生成新 key。

数据库 wrapper 对相同 key 使用 transaction advisory lock，并继续复用 `meals(couple_space_id, idempotency_key)` 唯一约束，避免并发重试形成重复餐食。

### 10.5 失败恢复

如果创建调用结果不确定：

```text
先 get_chatgpt_meal_record(same key)
-> 找到：视为已经成功，不再重复创建
-> 找不到：使用 same key 重试 create 一次
```

不得因为工具超时就换 key 再写。

### 10.6 数据边界

ChatGPT “记上”只允许影响：

```text
meals
meal_items
必要时 foods / food_aliases
```

不得直接影响：

```text
daily_record_sides.deficit_kcal
exercise_minutes
weight_measurements
wallets
wallet_ledger
金币 / 宝石 / heatmap
```

## 11. 同日关联规则

P2.5 将通过同一个业务键关联不同事实域：

```text
partnerKey + date
```

关联对象：

```text
meals / daily_nutrition_summary
+
daily_records + daily_record_sides
+
未来 daily_weight_summary
```

这是一层读取/展示关联，不是跨域写入：

- meals 存在、daily record 不存在：显示当天饮食，但 deficit/运动/体重快照显示“未记录”；
- daily record 存在、meals 不存在：显示游戏记录，但饮食显示“未记录”；
- 不用 meal total 自动覆盖 `deficit_kcal`；
- 若未来增加“实际能量缺口”，应新增独立定义，而不是重用现有游戏 deficit。

## 12. RPC 映射

| 调用方 / service | RPC |
|---|---|
| game cloud read | `export_home_sync_snapshot` |
| game cloud write | `replace_home_sync_snapshot` |
| Web meal list | `list_meals` |
| Web meal create | `create_meal_record` |
| Web meal update | `update_meal_record` |
| Web meal delete | `delete_meal_record` |
| ChatGPT confirmed meal create | `create_chatgpt_meal_record` |
| ChatGPT idempotency verification | `get_chatgpt_meal_record` |

`create_chatgpt_meal_record` 最终仍调用现有 `create_meal_record`，因此没有第二套餐食事实表。

## 13. 当前 API / RPC 安全边界

- 所有浏览器数据 API 必须验证共享 password/session；
- Supabase secret 只存在服务端或连接器授权层，不进入聊天文本和浏览器；
- API 响应 `no-store`；
- server-only RPC 不授权给 anon/authenticated；
- ChatGPT P2 RPC 同样只授权 service_role；
- 这是共享空间保护，不是单用户授权模型。

未来加入账号后，需要重新设计：

```text
Supabase Auth / external auth
membership
per-user authorization
RLS policies
audit / conflict strategy
```