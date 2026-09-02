# API、云端同步与鉴权

## 1. 当前 API 总览

| Method | Path | 作用 | 状态 |
|---|---|---|---|
| POST | `/api/cloud-session` | 验证同步密码并建立 cloud session | 已上线 |
| GET | `/api/home-data` | 从 Supabase 导出兼容游戏快照 | 已上线 |
| POST | `/api/save-data` | 将兼容游戏快照写回规范化 Supabase | 已上线 |
| GET | `/api/meals?date=...&person=...` | 查询某日餐食 | 已上线 |
| POST | `/api/meals` | 新增餐食 | 已上线 |
| PUT | `/api/meals/[id]` | 完整更新餐食 | 已上线 |
| DELETE | `/api/meals/[id]` | 软删除餐食 | 已上线 |

P2.5 同日关联**没有新增 API**。

## 2. 当前鉴权模型

这是私人小范围应用的共享访问保护，不是完整用户账号系统。

### Web

服务器环境变量：

```text
DATA_EDIT_PASSWORD
```

验证成功后设置：

```text
couple-cloud-session
```

Cookie：HttpOnly、production Secure、SameSite=Lax、Path=/、90 天。

`/api/home-data` 和 Meal API 通过有效 cloud session 或正确的 `x-couple-password` 访问。

`/api/save-data` 仍要求请求体 password，并要求已有 cloud session 才真正写入。

### ChatGPT

ChatGPT P2 不把同步密码或 Supabase secret 放进聊天，也不新增匿名写接口。

```text
ChatGPT
-> 已授权 Supabase 能力
-> service-only ChatGPT meal RPC
-> meals / meal_items
```

`anon / authenticated` 不获得这些 RPC 的 execute 权限。

## 3. 新设备保护

```text
新设备
-> 输入同步密码
-> POST /api/cloud-session
-> 建立 HttpOnly session
-> 先从云端下载
-> 再允许后续写回
```

如果没有 cloud session 就直接调用 `/api/save-data`：

```text
409 CLOUD_SESSION_REQUIRED
```

本次不会写云端，避免空本地状态覆盖生产数据。

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

`reloadFromGitHub / syncToGitHub / /data/couple-data.json` 仍是 legacy 内部命名 / compatibility shim，真实云端数据源已经是 Supabase。

## 5. Meal API

### 查询

```http
GET /api/meals?date=2026-09-01&person=cat
```

- `date` 必填，格式 `YYYY-MM-DD`；
- `person` 可选，`fish / cat`。

### 新增

```http
POST /api/meals
```

示例：

```json
{
  "partnerKey": "cat",
  "mealDate": "2026-09-01",
  "mealType": "lunch",
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

没有显式 meal total 时，校验层可以从 items 求和。

### 更新

```http
PUT /api/meals/<uuid>
```

当前语义是完整 meal payload 替换，不是 PATCH。

### 删除

```http
DELETE /api/meals/<uuid>
```

当前使用 soft delete。

### source

```text
manual
chatgpt
import
```

## 6. Meal 参数约束

- 单餐最多 50 item；
- kcal 为非负整数；
- weight / macros 为非负数；
- `min <= estimate <= max`；
- `snack_period` 只用于 snack；
- note 最长 2000；
- idempotency key 最长 200；
- foodId 如存在必须是 UUID；
- rawName 必须存在。

## 7. ChatGPT “记上”协议

### 确认边界

```text
讨论 / 看图 / 估算 / 修正 ≠ 数据库写入
```

只有明确“记上”“把这餐记下来”或等价保存意图后才持久化。

当前角色映射：

```text
用户自己的饮食聊天 -> cat（猫猫）
鱼鱼的饮食聊天     -> fish（鱼鱼）
```

用户当前明确说明角色时，以当前说明优先。

### 创建流程

```text
明确保存意图
-> 构造最终 meal payload
-> 生成 chatgpt: idempotency key
-> create_chatgpt_meal_record
-> meals + meal_items
-> get_chatgpt_meal_record(same key)
-> 成功后回复“已记上”
```

RPC 强制：

```text
source = chatgpt
status = confirmed
至少 1 个 item
item kcal 校验
meal total = item total
chatgpt: 前缀 idempotency key
同 key advisory lock
```

重试必须复用同一个 key。

### 数据边界

ChatGPT 餐食写入不得直接修改：

```text
deficit
exercise
weight
wallet / ledger
金币 / 宝石
heatmap
```

## 8. P2.5 同日关联（已上线）

业务关联键：

```text
partnerKey + date
```

P2.5 不走新 API，而是在浏览器展示层组合两条已有读取路径：

```text
DailyMealsPanel
├─ fetchMeals(date, partner)
│  -> Meal API -> Supabase meals / meal_items
│
└─ useHomeResources().dailyRecords
   -> selectDailyGameOverview(date, partner)
```

页面“当天合在一起看”展示：

- 当天总摄入 kcal；
- 所有餐都有区间时，展示总摄入区间；
- 游戏热量缺口；
- 运动分钟；
- 游戏体重快照。

缺失规则：

```text
无 meals                -> 实际摄入：未记录
Meal API 失败           -> 实际摄入：暂未加载
无该日 DailyRecord      -> 当天游戏记录未填写
有该日 DailyRecord      -> 展示该角色保存下来的现有值
```

这是一层**只读关联**：

- 不用 meal total 自动覆盖 `deficit_kcal`；
- 不自动创建 daily record；
- 不新增数据库权限。

旧 `DailyRecord` 没有“某一角色是否主动填写过 0”的 presence 标记，因此前端不进一步猜测 0 值来源。

## 9. RPC 映射

| 调用方 | RPC |
|---|---|
| game cloud read | `export_home_sync_snapshot` |
| game cloud write | `replace_home_sync_snapshot` |
| Web meal list | `list_meals` |
| Web meal create | `create_meal_record` |
| Web meal update | `update_meal_record` |
| Web meal delete | `delete_meal_record` |
| ChatGPT meal create | `create_chatgpt_meal_record` |
| ChatGPT read-back | `get_chatgpt_meal_record` |

P2.5 不新增 RPC。

## 10. 当前安全边界

- 浏览器数据 API 必须验证共享 password/session；
- Supabase secret 不进入浏览器或普通聊天；
- API 响应使用 `no-store`；
- server-only RPC 不授权 anon/authenticated；
- ChatGPT meal RPC 同样只授权 service-role 路径；
- 当前仍是共享空间保护，不是成熟单用户授权模型。
