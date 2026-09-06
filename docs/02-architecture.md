# 当前架构

状态：2026-09-06 / R11.5。

## 1. 一句话架构

Couple Better Game 是一个 Next.js 一体化 Web 应用：

```text
浏览器 UI
→ Next.js / Vercel API
→ canonical domain services / AI Access Core
→ Supabase PostgreSQL + Private Storage
```

AI 入口与 Web 入口共享同一个业务事实层，不维护第二套数据库。

## 2. 主要运行入口

### Web

```text
Browser
→ Next.js API
→ fixed/session identity
→ domain service
→ service-role RPC / Storage
→ Supabase
```

### Harbor ChatGPT Project

```text
Harbor Cat / Harbor Fish
→ Google Drive / Sheet Bridge
→ COMMAND + Fast Wake
→ /api/drive-bridge/*
→ life_query / life_mutate
→ AI Access Core
→ Supabase
```

### MCP

```text
MCP client
→ /mcp
→ life_query / life_mutate
→ AI Access Core
→ Supabase
```

### 程序内置 AI

```text
/life AI UI
→ /api/ai/chat
→ Vercel AI Gateway
→ life-agent-registry
→ AI Access Core
```

## 3. Source of Truth

正式生活数据事实源始终是 Supabase。

Google Sheet / Drive Bridge 的：

```text
COMMANDS
RECEIPTS
STATE_*
META
```

只是 AI 兼容传输 / 镜像层，不是数据库。

浏览器 stale cache、Service Worker cache、STATE_* 都属于可重建读模型。

## 4. 领域边界

主要 V2 领域：

```text
meal
weight
mood
sleep
activity
medicine
mailbox
settings
```

Legacy Game 保持独立：

```text
daily_records / daily_record_sides
wallet / exchange / settlement
```

核心关系：

```text
intake ≠ deficit ≠ weight ≠ exercise
```

Meal calories 不自动生成 deficit，不自动修改金币、宝石、钱包或 heatmap。

## 5. 饮食数据流

### Web

```text
LifeFoodPage / LifeMealEditorPage
→ meal-client
→ /api/meals + /api/meals/:id/photo
→ auth
→ supabase-nutrition
→ canonical RPC / Storage
→ meals + meal_items
```

### AI

```text
用户文字 / 图片
→ AI 先分析并在聊天里给草稿
→ 用户修改 / 确认
→ life_mutate
→ meal adapter
→ canonical meal service
→ Supabase
```

饮食草稿不是后台对象。服务端不通过确认关键词判断 meal create 是否允许执行。

## 6. 餐前 / 餐后与图片持久化

AI 可以同时利用餐前、餐后多图分析：

```text
实际摄入 = 餐前估计量 - 餐后剩余可食量
```

用户文字优先于视觉差分。

当前正式 meal 仍只绑定一张 `photo_path`：

```text
多图参与分析
→ 默认正式保存餐前图
→ 餐后图默认只用于估算
```

用户明确指定时可以改存餐后图。当前不支持同一 meal 永久绑定两张图片。

## 7. 餐食照片架构

```text
原图
→ EXIF normalize
→ 600px WebP compression
→ Private Storage meal-photos
→ meals.photo_path
```

R11.5 新增非破坏性显示元数据：

```text
photo_rotation_degrees
photo_scale
```

竖图上传后默认显示旋转 90°；用户可在 UI 左右旋转并调 60%–100% 大小。

真实照片使用 `MealPhotoFrame + object-contain`，留白优先于裁切。

## 8. AI 写入架构

稳定工具：

```text
life_capabilities
life_query
life_mutate
```

普通已知业务 query/mutate 不先调用 `life_capabilities`。

AI Access Core 负责：

- actor identity；
- permission；
- natural-language normalization；
- canonical resource dispatch；
- idempotency；
- media recovery；
- domain service 调用。

模型负责对话语义和草稿交互，但不能替代服务端权限。

## 9. Harbor Fast Path

普通 Harbor 请求：

```text
1 COMMAND
→ 1 Fast Wake
→ 同 command_id RECEIPT
→ 回复
```

真正业务结果只认 RECEIPT，不认 Wake HTTP 200。

同一个正式动作不能因为 processing / timeout 就生成多个 command id。

## 10. 图片恢复路径

MCP / 客户端不能传真实图片字节时：

```text
life_mutate attachPhoto=true
→ MEDIA_ATTACHMENT_REQUIRED
→ recovery.uploadUrl
→ browser upload
→ 服务端完成原操作
```

恢复后仍进入相同 canonical meal/storage 路径。

## 11. 目录职责

### `components/life/`

生活系统页面与 Pattern，包括：

```text
LifeFoodPage
LifeMealEditorPage
MealPhotoFrame
```

### `lib/nutrition/`

```text
meal-service.ts
meal-client.ts
chatgpt-meal-protocol.ts
```

### `lib/server/`

```text
life-agent-registry.ts
life-agent-executor.ts
life-ai-gateway.ts
life-mcp-tools.ts
supabase-nutrition.ts
image-compression.ts
```

### `lib/ai/`

保存自然语言输入规范与 AI 行为 contract，例如 `meal-draft-contract.ts`。

### `supabase/migrations/`

保存生产 schema / RPC / grant 的不可回写历史。

## 12. Migration 与 Production

数据库结构变化必须新增 migration，已执行 migration 不回改。

R11.5：

`20260906160000_add_meal_photo_display_transform.sql`

已在 Production Supabase 执行。

Vercel Git 自动部署保持默认关闭。每次 Production deployment 都必须获得用户当次明确授权，完成后立即恢复 `deploymentEnabled=false`。
