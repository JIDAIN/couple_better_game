# 🐟和🐱的岛屿生活

给两个人共同使用的生活记录与陪伴 Web App。当前主产品是 **Island Life / 情侣成长小岛**；早期“变美变瘦大作战”游戏继续作为保留子系统存在，但不再代表整个产品。

> 当前正式架构：**Next.js + React + TypeScript + Vercel + Supabase**。Supabase 是生活数据的云端事实源；浏览器本地缓存只负责无感加载与离线体验，不是权限或事实来源。

## 当前状态

2026-09-07 本轮核心改造已经进入收尾：

- 今日：心情、睡眠、活动、饮食与轻量提醒；
- 日历：双人心情与历史生活记录；
- 小窝：体重、家庭药箱、小信箱、游戏机；
- 饮食：Meal CRUD、营养字段、照片上传与压缩、AI 餐食草稿确认；
- 小信箱 V2：收信箱 / 已寄出 / 待寄出、手札 / 明信片、月份归档、草稿可编辑、寄出后永久只读；
- Reminder Center V1：自定义提醒、药箱到期、纪念日、完成 / 忽略 / snooze、PushPlus 微信投递；
- Cat / Fish 双身份权限边界：Web、API、MCP 与核心 RPC 都按服务端签名身份处理；
- AI Access Core：ChatGPT / MCP 可以查询和写入受控生活数据，未来新增生活 domain 继续复用这一层；
- 无感加载：scope-aware stale cache + mount / focus / visibility / online 后台校验，避免首屏和图片明显闪烁；
- Legacy Game：金币、宝石、成长地图、兑换等旧游戏能力继续保留。

完整现场状态、Production 版本与已知边界以 [`docs/09-status-roadmap.md`](docs/09-status-roadmap.md) 为准。

## 产品入口

底部主导航保持四个入口：

```text
今日 / 日历 / 小窝 / 我的
```

### 今日

- 我 / Ta 的心情、睡眠；
- 当日活动；
- 饮食记录与营养摘要；
- 最近提醒；
- 本地缓存立即显示，后台自动校验最新数据。

### 日历

- 月度双人心情；
- 按日期查看当天生活记录与营养信息；
- 页面恢复后自动后台同步。

### 小窝

- 体重趋势；
- 家庭药箱；
- 小信箱；
- 游戏机 / Legacy Game 入口。

### 我的

- 当前身份与昵称；
- Reminder Center / PushPlus；
- 数据导出、导入、备份和恢复。

## 小信箱 V2

```text
收信箱 / 已寄出 / 待寄出
```

核心规则：

```text
draft -> 只有寄件人可见，可编辑 / 删除 / 寄出
sent  -> 寄件人与收件人可见，永久只读
```

UI 使用纸张与邮寄视觉语言：

- 手札：整页信纸阅读与编辑，支持翻页；
- 明信片：始终水平横向，带邮票 / 邮戳 / 地址线与风景装饰；
- 收信箱、已寄出支持手札 / 明信片与月份筛选；
- 三个箱子的时间戳语义分别对应收到、寄出与最后编辑时间。

## Reminder Center / 微信提醒

当前提醒链路：

```text
生活模块 / 自定义提醒
        ↓
Reminder Engine
        ↓
life_reminder_rules / life_reminder_instances
        ↓
网页提醒中心 + Supabase pg_cron
        ↓
PushPlus
        ↓
Cat / Fish 对应微信
```

Reminder Engine 与 PushPlus 解耦；以后新增生理期、小信箱等提醒时继续复用同一套实例与投递层。

详细说明见 [`docs/14-wechat-reminders.md`](docs/14-wechat-reminders.md)。

## AI 接入

当前正式入口：

```text
Harbor Cat Project  → Harbor-Cat MCP  → OAuth cat  → /mcp
Harbor Fish Project → Harbor-Fish MCP → OAuth fish → /mcp
程序内置 AI                              → /api/ai/chat
                                      ↓
                              AI Access Core
                                      ↓
                              canonical services
                                      ↓
                                  Supabase
```

AI 昵称、用户自称或普通文本中的 `cat / fish` 不参与鉴权；真正身份来自登录 / OAuth / 服务端签名上下文。

AI 可以在权限范围内读写已接入的生活 domain。新增生理期等模块时，应扩展 domain service + AI Access Core / MCP tool，而不是重做整套 AI 接入。

## 饮食与照片

饮食分析遵守：

```text
讨论 / 估算 / 修正 ≠ 自动保存
明确确认保存 -> 才持久化
```

图片处理：

```text
EXIF normalize
→ 最长边 600px
→ WebP quality 70
→ 超过 120 KB 再逐步降低质量
→ 最低 quality 55
→ 一般目标 50～100 KB
```

当前一条正式 meal 绑定 1 张展示照片；多图可以参与 AI 分析，但暂不做多图持久化模型。

## 数据与权限

生活系统主要采用：

```text
Browser / MCP
    ↓
Next.js server / AI Access Core
    ↓
actor-aware canonical RPC / service
    ↓
Supabase
```

原则：

- Supabase 是生活数据事实源；
- 浏览器不持有 `service_role`；
- Web session 与 MCP token 都绑定 Cat / Fish 身份；
- 个人数据默认 owner-only 写入；
- 药箱、纪念日等明确的 couple-space 数据可由双方共同维护；
- PushPlus token 加密存入 Supabase Vault，不读回客户端；
- RLS 与 service-only RPC 共同限制直接表访问。

详细权限矩阵见 [`docs/17-auth-and-pairing.md`](docs/17-auth-and-pairing.md)。

## Legacy Game 与生活数据

生活系统与旧游戏系统继续隔离维护。尤其：

```text
实际饮食摄入 ≠ Legacy Game deficit ≠ 真实体重 ≠ 运动
```

展示层可以按 `partnerKey + date` 关联，但一个 domain 不得擅自覆盖另一个 domain 的事实数据。

详见 [`docs/48-life-legacy-game-data-boundary.md`](docs/48-life-legacy-game-data-boundary.md)。

## 开发与验证

```bash
npm install
npm run dev
npm run test
npm run lint
npm run build
```

Production 发布前至少要求：

```text
Test ✅
Lint ✅
Build ✅
```

Production 自动部署长期保持关闭；每次 Production deployment 都必须获得用户当次明确授权，完成后继续保持 `vercel.json -> git.deploymentEnabled=false`。

## 目录

```text
app/                     Next.js 页面与 API Routes
components/life/         Island Life 业务 UI
components/home/         Legacy Game UI / Provider
components/ui/           共享 UI shell / wrapper
lib/life/                生活 domain client / service
lib/server/              服务端鉴权、AI、通知与 Supabase 访问
lib/nutrition/           Meal / nutrition 逻辑
lib/home/                Legacy Game 领域逻辑
supabase/migrations/     Production 数据库迁移历史
tests/                   Test / source contract / service tests
docs/                    当前有效主文档
```

## 文档入口

第一次接手项目建议依次阅读：

1. [`docs/README.md`](docs/README.md)
2. [`docs/01-product.md`](docs/01-product.md)
3. [`docs/02-architecture.md`](docs/02-architecture.md)
4. [`docs/03-data-model.md`](docs/03-data-model.md)
5. [`docs/04-api-and-sync.md`](docs/04-api-and-sync.md)
6. [`docs/09-status-roadmap.md`](docs/09-status-roadmap.md)
7. [`docs/11-ai-write-architecture.md`](docs/11-ai-write-architecture.md)
8. [`docs/14-wechat-reminders.md`](docs/14-wechat-reminders.md)
9. [`docs/17-auth-and-pairing.md`](docs/17-auth-and-pairing.md)

AI / 自动化修改前必须先读 [`AGENTS.md`](AGENTS.md)。
