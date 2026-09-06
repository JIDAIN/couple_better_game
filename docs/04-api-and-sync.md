# API、云端同步与鉴权

状态：2026-09-06。

## 1. API 总览

### 生活与餐食

| Method | Path | 作用 |
|---|---|---|
| GET | `/api/meals?date=...&person=...` | 查询某日餐食 |
| POST | `/api/meals` | 新增餐食 |
| PUT | `/api/meals/[id]` | 更新餐食 |
| DELETE | `/api/meals/[id]` | 软删除餐食 |
| GET | `/api/meals/[id]/photo` | 读取私有餐食照片 |
| PUT | `/api/meals/[id]/photo` | 上传 / 更换餐食照片 |
| PATCH | `/api/meals/[id]/photo` | 修改照片显示旋转 / 大小 |
| DELETE | `/api/meals/[id]/photo` | 移除餐食照片 |
| GET | `/api/life/day?date=YYYY-MM-DD` | 读取当天心情、睡眠、活动 |
| PUT | `/api/life/mood` | 保存 / 修改心情 |
| PUT | `/api/life/sleep` | 保存 / 修改睡眠 |
| POST | `/api/life/activities` | 新增活动 |
| PUT | `/api/life/activities/[id]` | 修改活动 |
| DELETE | `/api/life/activities/[id]` | 删除活动 |

### AI 入口

```text
/mcp
/api/drive-bridge/*
/api/ai/chat
```

三条入口最终都进入 AI Access Core / canonical domain services。

## 2. 当前鉴权模型

浏览器：

```text
Browser
→ Next.js API
→ 当前登录 / cloud session 鉴权
→ server-side domain service
→ service-role RPC
→ Supabase
```

浏览器不持有 Supabase service secret。

AI：

- Harbor Cat / Fish 通过固定 Bridge 身份 + HMAC；
- MCP 使用对应 OAuth / fixed access identity；
- 程序内置 AI 使用当前登录身份；
- AI 昵称不参与权限判断。

## 3. Meal API

### 查询

```http
GET /api/meals?date=2026-09-06&person=cat
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

Meal 和 Meal Item 的 kcal / macros 允许 nullable：

```text
NULL = 未估算
0    = 确实为 0
```

## 4. Meal Photo API

### 上传 / 更换

```text
PUT /api/meals/<uuid>/photo
```

服务端执行：

```text
鉴权
→ 图片校验
→ EXIF 方向归一
→ 最长边 600px WebP 压缩
→ Storage 上传
→ 根据最终宽高计算默认显示旋转
→ replace_meal_photo_state
```

竖图默认：

```text
rotationDegrees = 90
scale = 1.00
```

### 修改显示

```text
PATCH /api/meals/<uuid>/photo
```

Payload 只允许：

```text
rotationDegrees: 0 | 90 | 180 | 270
scale: 0.60 .. 1.00
```

PATCH 不重新压缩 / 上传图片。

### 删除

```text
DELETE /api/meals/<uuid>/photo
```

同时恢复显示元数据到 `0° / 100%`。

## 5. AI 写入统一协议

稳定入口：

```text
life_query
life_mutate
```

普通查询不应先调用 `life_capabilities`；只有未知能力发现或开发排错时才需要。

正式写入统一原则：

```text
自然语言
→ AI 提取语义
→ canonical normalize / validate
→ permission
→ idempotency
→ domain write
→ read-back / receipt
```

不提供任意 SQL 或任意表修改工具。

## 6. 新 Meal 的聊天层草稿流程

新的饮食记录使用：

```text
用户文字 / 图片
→ AI 分析实际摄入
→ 聊天中展示待确认草稿
→ 用户修改 / 确认
→ life_mutate 正式写入
```

关键边界：

- 草稿不写数据库；
- 没有 `meal_drafts` 后台表；
- 服务端不通过当前 `userText` 是否包含“确认/可以/好的”来决定能不能 create meal；
- 确认状态属于对话上下文；
- 如果确认后的写入临时失败，用户说“再试一次”时，AI 可以重试已确认的正式操作。

身份、删除、高风险覆盖等安全规则仍必须由服务端硬校验。

## 7. 饮食实际摄入与营养字段

AI 默认统计实际吃下去的量。

优先级：

```text
用户明确文字
>
餐前/餐后图片差分
>
单图估算
```

能合理判断时，确认后的单次正式写入尽量包含：

```text
items[].rawName / displayName
items[].portionDescription
items[].estimatedWeightG
items[].caloriesKcal
items[].proteinG
items[].carbsG
items[].fatG
totalCaloriesKcal
```

真正未知字段允许 `null`，不能编造精确值。

## 8. 多图与单图持久化

聊天里可以同时使用餐前 / 餐后多张图片做差分，但当前正式 meal 只绑定 1 张展示图。

默认：

```text
餐前 + 餐后都参与分析
→ 未指定时正式保存餐前图
→ 餐后图只作为估算依据
```

用户明确指定“保存餐后图”时覆盖默认。

当前系统不能声称同一 meal 永久保存两张照片，也不支持 `beforePhotoPath / afterPhotoPath`。

## 9. MCP 图片恢复

如果用户要求正式保存图片，但 MCP 客户端没有传真实图片字节：

```text
life_mutate attachPhoto=true
→ MEDIA_ATTACHMENT_REQUIRED
→ recovery.uploadUrl
→ 用户浏览器补传
→ 完成原正式操作
```

收到恢复链接后：

- 不重新 create meal；
- 不重复 life_mutate；
- 不再生成第二套业务参数；
- 未完成前不能声称照片已保存。

## 10. Harbor Fast Path

正常 Harbor query/mutate：

```text
1 COMMAND
→ 1 Fast Wake
→ 同 command_id RECEIPT
→ 回复
```

`locked / processing / receiptReady=false` 时，只等待同一 receipt，不重复 Wake / command。

业务成功只认 RECEIPT `ok=true`，不能把 Wake HTTP 200 当成成功。

## 11. 游戏云端同步

Legacy Game 兼容同步仍保持：

```text
GET  /api/home-data
POST /api/save-data
```

内部 legacy GitHub 命名 / compatibility shim 不改变 Supabase 是事实源这一点。

Meal calories 不自动生成 deficit，也不自动修改金币、宝石、钱包或 heatmap。

## 12. 安全与部署边界

- 浏览器不持有 Supabase secret；
- server-only RPC 不开放给任意浏览器；
- AI 入口绑定固定 actor；
- 写入使用稳定幂等边界；
- 图片 bucket 为 private；
- Production 自动部署默认关闭；
- 每一次新的 Production deployment 都必须获得用户当次明确授权。
