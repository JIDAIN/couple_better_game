# 🐟和🐱变美变瘦大作战

一个给两个人共同使用的健康习惯养成 Web 应用：每天记录游戏化的热量缺口、运动与体重快照，通过金币/宝石、成长地图和兑换商店形成持续反馈；同时记录实际饮食，并继续扩展真实体重趋势能力。

> 当前已经不是“纯前端 localStorage MVP”。生产环境由 **Next.js + Vercel + Supabase** 组成；浏览器保留 localStorage 作为游戏运行缓存和离线兜底，Supabase 是云端主数据源。

## 当前能做什么

### 已上线

- 双人每日记录：鱼鱼 / 猫猫分别记录体重快照、`deficit`、运动分钟。
- 游戏化结算：根据当前规则产生每日金币、周期宝石、情侣奖励。
- 成长地图：按自然月、周六到周五展示双人热力图。
- 成长日志：查看、补录、编辑、删除历史记录。
- 兑换商店：维护奖励分类、兑换、查看和修改兑换记录。
- 数据管理：本地缓存、云端同步、完整 JSON 备份/恢复、每周复盘 CSV。
- 云端数据：Supabase 保存规范化的游戏、钱包、营养和体重数据。
- 新设备安全接入：先验证同步密码并下载云端数据，防止空本地状态覆盖云端。
- 饮食后端：`/api/meals` CRUD 和 Supabase 事务 RPC 已上线并验证。
- 今日饮食 UI：在现有「今日」公告板中按日期和鱼鱼/猫猫查看饮食，支持手动新增、编辑、软删除、热量区间和食物明细展开。

### 尚未上线

- ChatGPT 对话中明确说“记上”后写入饮食数据库的完整产品流程。
- 独立体重趋势 API / 折线图。
- 饮食、体重、游戏数据的统一每日总览。
- 完整用户账号 / 多成员权限系统。

当前进度和下一步以 [`docs/09-status-roadmap.md`](docs/09-status-roadmap.md) 为准。

## 四个必须分开的数据域

| 数据域 | 含义 | 当前真相来源 |
|---|---|---|
| 饮食摄入 | 实际吃了什么、估算摄入多少 kcal | `meals` / `meal_items` |
| `deficit` | 现有游戏打卡字段 | `daily_record_sides.deficit_kcal` / `DailyRecordSide.deficit` |
| 体重 | 真实测量时间序列 | `weight_measurements` |
| 运动 | 当天运动分钟 | `daily_record_sides.exercise_minutes` |

**不要把 `deficit` 当作饮食摄入，也不要由餐食热量自动反推或覆盖 `deficit`。** 这是项目最重要的数据边界之一。

## 当前架构

```text
浏览器
├─ components/home         游戏业务 UI
├─ components/nutrition    饮食业务 UI
├─ components/ui           animal-island-ui 项目 wrapper
├─ HomeResourcesProvider   游戏状态/同步编排
├─ lib/home                游戏规则 / service / snapshot / localStorage store
├─ lib/nutrition           餐食类型、校验、浏览器 meal client
└─ localStorage            游戏运行缓存、同步元数据
        │
        │ HTTPS
        ▼
Vercel / Next.js
├─ app/api/home-data       云端游戏快照读取
├─ app/api/save-data       云端游戏快照写入
├─ app/api/cloud-session
├─ app/api/meals           饮食查询 / 新增
├─ app/api/meals/[id]      饮食修改 / 删除
└─ lib/server              服务端鉴权和 Supabase RPC client
        │
        ▼
Supabase PostgreSQL
├─ 游戏规范化表
├─ 钱包 / 流水
├─ meals / meal_items / foods
├─ weight_measurements
└─ 只允许服务端 secret-key 路径访问
```

详细边界见 [`docs/02-architecture.md`](docs/02-architecture.md)。

## UI 原则

项目已经完成 animal-island-ui 视觉迁移。新增功能继续维护原有“动物岛 / 手账 / Nook 商店”视觉语言：

- 优先复用 `components/ui/App*` wrapper；
- 不另造第二套 Button / Card / Modal 风格；
- 当前饮食 UI 作为「今日」notice-board 的一部分，不擅自增加第五个底部 Tab；
- 大型视觉改版才重新做整体 UI 设计审查。

详细规范见 [`docs/06-ui-guidelines.md`](docs/06-ui-guidelines.md)。

## 本地开发

```bash
npm install
npm run dev
```

常用检查：

```bash
npm run test
npm run lint
npm run build
```

应用游戏核心界面可以使用本地缓存运行；饮食 CRUD 和云端 API 需要有效 cloud session / 服务端环境变量。环境变量名称和安全要求见 [`docs/08-deployment-security.md`](docs/08-deployment-security.md)。

## 目录

```text
app/                     Next.js 页面与 API Route
components/home/         游戏业务 UI / Provider
components/nutrition/    饮食列表与餐食编辑 UI
components/ui/           项目 UI wrapper
lib/home/                游戏领域、规则、store、导入导出
lib/nutrition/           饮食类型、校验、浏览器 API client
lib/server/              服务端鉴权和 Supabase 访问
supabase/migrations/     production 数据库结构变更历史
tests/home/              游戏领域测试
tests/nutrition/         饮食领域测试
docs/                    当前有效项目文档
.codex/skills/           项目维护 Skill
```

## 文档入口

第一次阅读项目，建议按顺序看：

1. [`docs/README.md`](docs/README.md) — 文档地图
2. [`docs/01-product.md`](docs/01-product.md) — 产品和功能
3. [`docs/02-architecture.md`](docs/02-architecture.md) — 当前实现架构
4. [`docs/03-data-model.md`](docs/03-data-model.md) — 数据真相与数据库
5. [`docs/04-api-and-sync.md`](docs/04-api-and-sync.md) — API、同步、鉴权
6. [`docs/05-business-rules.md`](docs/05-business-rules.md) — 当前游戏规则
7. [`docs/09-status-roadmap.md`](docs/09-status-roadmap.md) — 当前进度和下一步

AI / 自动化修改代码前必须先阅读 [`AGENTS.md`](AGENTS.md)。

## 数据与隐私

- Supabase secret key 只能存在于 Vercel / 服务端环境变量，禁止 `NEXT_PUBLIC_*` 暴露。
- 浏览器不直接连接带服务端权限的 Supabase client。
- 旧的公开 GitHub JSON 同步已经退出，`public/data/couple-data.json` 不再属于当前版本。
- 历史 Git 缓存清理仍由 GitHub Support 工单跟进，状态见 roadmap。

## 当前原则

这个项目优先保证：

1. **事实数据不混淆。**
2. **游戏规则可回算。**
3. **云端写入有保护，不因新设备误覆盖。**
4. **UI、业务规则、服务端和数据库边界清楚。**
5. **文档描述当前真实实现，不把“未来方案”写成“已经实现”。**
