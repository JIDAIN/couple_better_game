# 当前架构

状态：2026-09-07 / R11.5。

## 1. 一句话架构

Couple Better Game 是一个 Next.js 一体化 Web 应用：

```text
浏览器 UI / AI Client
→ Next.js / Vercel API
→ canonical domain services / AI Access Core
→ Supabase PostgreSQL + Private Storage
```

AI 与 Web 共享同一个业务事实层，不维护第二套数据库。

当前产品关系：

```text
Couple Better Game（当前主程序 / Island Life）
└─ 游戏
   └─ 变瘦变美大作战（Legacy Game 子项目）
```

旧版“变瘦变美大作战”已经被收纳为新程序「游戏」中的独立子项目，不再代表整个应用。

## 2. 主要运行入口

### Web

```text
Browser
→ Next.js API
→ session identity
→ domain service
→ service-role RPC / Storage
→ Supabase
```

### Harbor ChatGPT Project

```text
Harbor Cat
→ Harbor-Cat MCP
→ OAuth = cat
→ /mcp
→ life_query / life_mutate
→ AI Access Core
→ Supabase

Harbor Fish
→ Harbor-Fish MCP
→ OAuth = fish
→ /mcp
→ life_query / life_mutate
→ AI Access Core
→ Supabase
```

Cat / Fish 身份由 OAuth token 绑定，不能由聊天中的昵称、自称或 `person` 文本切换。

### 其他 MCP client

```text
MCP client
→ OAuth / fixed access identity
→ /mcp
→ life_query / life_mutate
→ AI Access Core
→ Supabase
```

### 程序内置 AI

```text
/ai
→ /api/ai/chat
→ Vercel AI Gateway
→ life-agent-registry
→ AI Access Core
→ Supabase
```

## 3. Source of Truth

正式生活数据事实源始终是 Supabase。

浏览器 stale cache、Service Worker cache 等只属于可重建读模型，不是第二数据库。

## 4. 领域边界

主要 Island Life 领域：

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

Legacy Game 是「游戏」里的独立旧程序子项目：

```text
daily_records / daily_record_sides
wallet / wallet_ledger
exchange / settlement
```

核心关系：

```text
intake ≠ deficit ≠ weight ≠ exercise
Island Life maintenance ≠ Legacy Game maintenance
```

Meal calories 不自动生成 deficit，不自动修改金币、宝石、钱包或 heatmap。

任何 Life 测试数据清理、Life import / restore 都默认不得碰 Legacy Game。完整表级 allowlist 与维护规则见 [`48-life-legacy-game-data-boundary.md`](48-life-legacy-game-data-boundary.md)。

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
→ AI 在聊天里给草稿
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

当前正式 meal 仍只绑定一张 `photo_path`。多图可参与分析；默认保存餐前图，用户明确指定时可改存餐后图。

## 7. 餐食照片架构

```text
原图
→ EXIF normalize
→ 600px WebP compression
→ Private Storage meal-photos
→ meals.photo_path
```

显示元数据：

```text
photo_rotation_degrees
photo_scale
```

真实照片使用 `MealPhotoFrame + object-contain`，留白优先于裁切。

## 8. AI 写入架构

稳定工具：

```text
life_capabilities
life_query
life_mutate
```

普通已知业务 query/mutate 不先调用 `life_capabilities`。

AI Access Core 负责身份、权限、归一化、幂等、媒体边界与 canonical resource dispatch；模型负责对话语义和草稿交互，但不能替代服务端权限。

`legacy_home` 属于 Legacy Game 兼容入口，不是普通 Island Life resource；旧游戏覆盖只能在用户明确要求游戏操作时执行。

## 9. 图片恢复路径

MCP 客户端不能传真实图片字节时：

```text
life_mutate attachPhoto=true
→ MEDIA_ATTACHMENT_REQUIRED
→ recovery.uploadUrl
→ browser upload
→ 服务端完成原操作
```

ChatGPT Custom MCP 已支持 OpenAI 临时文件地址直传；能直接取得附件时不进入 recovery。

## 10. 目录职责

### `components/life/`
生活系统页面与交互组件。

### `lib/nutrition/`
Meal service / client / protocol。

### `lib/server/`
AI Access Core、MCP、canonical server adapters、Supabase services、图片压缩。

### `lib/ai/`
自然语言输入规范与 AI 行为 contract。

### `supabase/migrations/`
Production schema / RPC / grant 的不可回写历史。

### `lib/server/life-data-domains.ts`
Island Life / Legacy Game / Shared System 的表级 allowlist 与维护保护。

## 11. Harbor Project 指令

当前有效模板：

`docs/46-harbor-mcp-project-instructions.md`

Harbor Cat 只使用 `Harbor-Cat`，Harbor Fish 只使用 `Harbor-Fish`。

## 12. Migration 与 Production

数据库结构变化必须新增 migration，已执行 migration 不回改。

Vercel Git 自动部署保持默认关闭。每次 Production deployment 都必须获得用户当次明确授权，完成后立即恢复 `deploymentEnabled=false`。
