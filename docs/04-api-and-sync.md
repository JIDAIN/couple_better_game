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

## 10. RPC 映射

| API / service | RPC |
|---|---|
| game cloud read | `export_home_sync_snapshot` |
| game cloud write | `replace_home_sync_snapshot` |
| meal list | `list_meals` |
| meal create | `create_meal_record` |
| meal update | `update_meal_record` |
| meal delete | `delete_meal_record` |

## 11. 当前 API 安全边界

- 所有数据 API 必须验证共享 password/session；
- Supabase secret 只存在服务端；
- API 响应 `no-store`；
- server-only RPC 不授权给 anon/authenticated；
- 这是共享空间保护，不是单用户授权模型。

未来加入账号后，需要重新设计：

```text
Supabase Auth / external auth
membership
per-user authorization
RLS policies
audit / conflict strategy
```
