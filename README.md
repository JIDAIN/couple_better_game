# 🐟和🐱变美变瘦大作战

一个给两个人共同使用的健康习惯养成 Web 应用：既保留 `deficit / 运动 / 游戏奖励 / 成长地图 / 兑换` 的游戏化坚持机制，也记录真实饮食，并继续扩展真实体重趋势。

> 当前生产架构是 **Next.js + Vercel + Supabase**。浏览器 localStorage 是游戏运行缓存和离线兜底；Supabase 是云端主数据源。

## 当前状态

已经完成：

- 双人每日游戏记录：鱼鱼 / 猫猫分别记录 `deficit`、运动分钟和体重快照；
- 金币 / 宝石、情侣奖励、成长地图、成长日志、兑换商店；
- 云端同步、新设备 download-before-write 保护、JSON 备份 / 恢复、周复盘 CSV；
- Supabase 规范化 schema 与 migration 版本管理；
- Meal CRUD API；
- 今日饮食 UI；
- ChatGPT 明确说“记上”后的餐食持久化；
- **P2.5 同日关联**：同一 `角色 + 日期` 下，把实际摄入与当天游戏 `deficit / 运动 / 体重快照` 放在一起展示。

当前下一步：

```text
P3 — 体重趋势
```

完整进度以 [`docs/09-status-roadmap.md`](docs/09-status-roadmap.md) 为准。

## 四个必须分开的健康数据域

| 数据域 | 含义 | 当前真相来源 |
|---|---|---|
| 饮食摄入 | 实际吃了什么、估算多少 kcal | `meals / meal_items` |
| 游戏 deficit | 现有游戏打卡热量缺口 | `daily_record_sides.deficit_kcal` / `DailyRecordSide.deficit` |
| 真实体重 | 测量时间序列 | `weight_measurements` |
| 运动 | 当天运动分钟 | `daily_record_sides.exercise_minutes` |

核心规则：

```text
intake ≠ deficit ≠ weight ≠ exercise
```

但在展示层，它们应按：

```text
partnerKey + date
```

关联为“同一天”。关联展示不等于跨域写入，尤其**不能用 meals 自动覆盖游戏 deficit**。

## 当前页面

底部主导航固定为四个 Tab：

```text
今日 / 地图 / 兑换 / 小窝
```

### 今日

- 游戏资源和当日打卡；
- 「饮食小记」：按日期 / 角色查看餐食、总摄入和区间；
- “当天合在一起看”：同日展示实际摄入、游戏热量缺口、运动、体重快照；
- 手动新增 / 编辑 / 删除餐食。

### 地图

- 双人月度成长热力图；
- 周六到周五完整周；
- 跨月真实记录继续显示但弱化。

### 兑换

- 奖励分类；
- 金币 / 宝石兑换；
- 兑换历史。

### 小窝

- 最近记录；
- 规则说明；
- 数据管理；
- 成长日志。

## ChatGPT “记上”规则

```text
估算 / 讨论 / 修正 ≠ 保存
明确“记上”或等价保存意图 -> 才写入
```

当前角色约定：

```text
用户自己的饮食聊天 -> cat（猫猫）
鱼鱼的饮食聊天     -> fish（鱼鱼）
```

一次确认只生成一个 `chatgpt:` 幂等键；结果不确定时先按同 key 查询，再用同 key 重试，禁止换 key 盲目重写。

ChatGPT 写入只影响 `meals / meal_items`，不会自动修改 deficit、运动、体重、钱包、金币、宝石或 heatmap。

详细流程见 [`docs/04-api-and-sync.md`](docs/04-api-and-sync.md)。

## 当前架构

```text
Browser
├─ components/home          游戏 UI / Provider
├─ components/nutrition     饮食 UI
├─ components/ui            App* / animal-island-ui wrapper
├─ lib/home                 游戏规则 / service / local cache
├─ lib/nutrition            Meal validation / client / ChatGPT protocol
└─ localStorage             游戏运行缓存
       │
       ▼
Next.js / Vercel
├─ /api/home-data
├─ /api/save-data
├─ /api/cloud-session
├─ /api/meals
├─ /api/meals/[id]
└─ lib/server
       │
       ▼
Supabase PostgreSQL
├─ game / wallet tables
├─ meals / meal_items / foods
├─ weight_measurements
└─ server-only / service-only RPC
```

P2.5 不新增数据库或 API：`DailyMealsPanel` 读取 Meal API，同时只读 `HomeResourcesProvider.dailyRecords`，通过 `selectDailyGameOverview(date, role)` 关联当天游戏快照。

详细架构见 [`docs/02-architecture.md`](docs/02-architecture.md)。

## UI 原则

项目继续维护既有的“动森 / 手账 / Nook 商店”视觉语言：

- 优先复用 `components/ui/App*`；
- 不另造第二套 Button / Card / Modal；
- 饮食继续属于「今日」notice-board；
- 普通功能不得擅自增加第五个主 Tab；
- 大型视觉改版才重新做整体 UI 设计审查。

详细规范见 [`docs/06-ui-guidelines.md`](docs/06-ui-guidelines.md)。

## 开发与验证

```bash
npm install
npm run dev
npm run test
npm run lint
npm run build
```

最新 P2.5 CI：Test / Lint / Build 全部通过，Vercel production 为 READY。

## 目录

```text
app/                     Next.js 页面与 API Route
components/home/         游戏业务 UI / Provider
components/nutrition/    饮食 UI / 同日关联展示
components/ui/           动森感 App* wrapper
lib/home/                游戏领域、daily overview、store、导入导出
lib/nutrition/           Meal 类型、校验、browser client、ChatGPT protocol
lib/server/              服务端鉴权和 Supabase 访问
supabase/migrations/     production 数据库迁移历史
tests/home/              游戏和 daily overview 测试
tests/nutrition/         饮食测试
docs/                    当前有效主文档
.codex/skills/           项目维护 Skill
```

## 文档入口

第一次阅读项目：

1. [`docs/README.md`](docs/README.md)
2. [`docs/01-product.md`](docs/01-product.md)
3. [`docs/02-architecture.md`](docs/02-architecture.md)
4. [`docs/03-data-model.md`](docs/03-data-model.md)
5. [`docs/04-api-and-sync.md`](docs/04-api-and-sync.md)
6. [`docs/05-business-rules.md`](docs/05-business-rules.md)
7. [`docs/09-status-roadmap.md`](docs/09-status-roadmap.md)

AI / 自动化修改前必须先读 [`AGENTS.md`](AGENTS.md)。

## 数据与隐私

- Supabase secret 只允许服务端 / 已授权连接层使用；
- 浏览器不直接持有 service-role 能力；
- ChatGPT 使用受限 meal RPC，不把连接能力当通用数据库写入口；
- 旧公开 GitHub JSON 已退出当前架构；
- GitHub 历史 cached views 仍按 Support 工单处理，状态见 roadmap。
