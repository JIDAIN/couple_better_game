# AGENTS.md

本文件是所有 AI 编程助手和自动化开发工具的项目级规则。修改代码、数据库、测试、文档前必须先阅读本文件。

## 1. 项目现状

项目是「🐟和🐱变美变瘦大作战」，技术栈为：

- Next.js 16 / React 19 / TypeScript / Tailwind CSS
- `animal-island-ui`
- Vitest
- Vercel
- Supabase PostgreSQL

当前不是纯前端项目：

- 浏览器 `localStorage` 是运行缓存和离线兜底；
- Supabase 是生产云端主数据源；
- Next.js API Route 是浏览器与 Supabase 的服务端边界；
- Supabase secret key 只允许服务端使用。

## 2. 开始任务前的阅读顺序

至少阅读：

1. `README.md`
2. `docs/README.md`
3. `docs/09-status-roadmap.md`
4. 与任务相关的主文档和源码

按任务追加：

| 任务 | 必读 |
|---|---|
| 产品 / 页面流程 | `docs/01-product.md` |
| 架构 / 重构 | `docs/02-architecture.md` |
| 数据字段 / Supabase | `docs/03-data-model.md` |
| API / 同步 / 鉴权 | `docs/04-api-and-sync.md` |
| 金币 / 宝石 / 热力图 | `docs/05-business-rules.md` |
| UI / animal-island-ui | `docs/06-ui-guidelines.md` |
| 开发 / 测试 | `docs/07-development-testing.md` |
| 部署 / 安全 | `docs/08-deployment-security.md` |

如果使用 Codex 项目 Skill，再读取：

- `.codex/skills/couple-better-game-maintainer/SKILL.md`

## 3. 四个领域绝对不能混淆

```text
饮食摄入 ≠ deficit ≠ 体重 ≠ 运动
```

- **饮食摄入**：实际吃了什么，写 `meals / meal_items`。
- **deficit**：现有游戏打卡字段，写 `daily_record_sides.deficit_kcal`；不要解释成“摄入热量”。
- **体重**：真实趋势写 `weight_measurements`；`daily_record_sides.weight_kg` 只是当天游戏快照。
- **运动**：每日游戏事实 `exercise_minutes`。

任何新功能都不得因为“看起来可以计算”而自动把一个域覆盖到另一个域。

## 4. Source of Truth 与派生数据

### 游戏事实 / 配置

主要事实数据：

- `daily_records` + `daily_record_sides`
- `exchange_records`
- `exchange_categories`
- `app_configs`
- `wallet_ledger`（资源变化审计事实）

### 营养事实

- `meals`
- `meal_items`
- 可选引用 `foods / food_aliases`

餐食保存时必须保留 `raw_name`；无法解析到 canonical food 时，`food_id = null` 不能阻塞保存。

### 体重事实

- `weight_measurements`

### 派生 / 可回算数据

- 当前钱包余额快照 `wallets`
- 前端 `wallet`
- `weekGemTotal / weekCoinTotal`
- `streakDays / weeklySuccessDays / cumulativeSuccessDays`
- 今日 / 昨日奖励汇总
- heatmap overrides

修改历史事实后，应优先重算派生值，不要手工拼出一个“看起来正确”的余额。

## 5. 前端分层

### `components/home/`

负责业务 UI、表单、弹窗、页面组合和调用 action。

禁止：

- 把结算规则重新写进 JSX；
- 直接使用 Supabase secret 或服务端 SDK；
- 自己计算钱包最终余额；
- 为小功能大规模重构 Provider。

### `components/ui/`

项目视觉 wrapper。UI 改动优先复用已有 `App*` 组件和 `animal-island-ui`，见 `docs/06-ui-guidelines.md`。

### `HomeResourcesProvider.tsx`

当前是游戏状态编排器和同步编排器。应尽量只：

- 持有 React state；
- 调用 `lib/home` service；
- 写入 AppDataStore；
- 编排云端同步；
- 向 UI 暴露 action。

如果单次修改 Provider 超过约 50 行，先判断逻辑是否应该下沉到 `lib/home` 或独立 client/service。

### localStorage 规则

业务快照只能通过 `AppDataStore` 访问。

当前同步元数据 / 同步密码仍有 Provider / DataManagement 直接访问 localStorage/sessionStorage 的兼容代码，这是**现存技术债**，不是新代码可以继续扩散的模式。

## 6. 游戏领域代码

优先位置：

- 类型：`lib/home/types.ts`
- 规则：`lib/home/settlement-rules.ts`
- 每日记录：`lib/home/daily-record-service.ts`
- 兑换：`lib/home/exchange-service.ts`
- 统计 / 钱包：`lib/home/home-stat-service.ts`
- 状态恢复：`lib/home/home-state-service.ts`
- snapshot：`lib/home/app-data-store.ts`
- 导入导出：`lib/home/import-service.ts`、`export-service.ts`

不要根据变量名猜当前金币 / 宝石语义。项目经历过 currency semantics 迁移，存在 legacy 字段名；修改规则前必须读 `docs/05-business-rules.md` 和 `lib/home/currency-semantics.ts`。

## 7. 营养领域代码

- 参数 / 类型 / 校验：`lib/nutrition/meal-service.ts`
- 服务端 Supabase 调用：`lib/server/supabase-nutrition.ts`
- API：`app/api/meals/**`
- 测试：`tests/nutrition/**`

### ChatGPT 餐食原则

“讨论 / 估算”不等于保存。

只有用户明确确认 **“记上”** 后，ChatGPT 工作流才应持久化餐食；写入时：

- `source = "chatgpt"`
- 只改 `meals / meal_items`（以及明确需要的 food/alias 引用）
- 不直接改 deficit、钱包、金币、宝石、热力图
- 使用 `idempotency_key` 防止重复提交

## 8. API 与服务端规则

浏览器访问路径必须是：

```text
Browser -> Next.js API -> lib/server -> Supabase
```

禁止：

- 在前端暴露 `SUPABASE_SECRET_KEY` / service role key；
- 使用 `NEXT_PUBLIC_SUPABASE_SECRET_KEY`；
- 恢复公开 GitHub JSON 作为用户数据源；
- 让匿名浏览器直接获得当前 server-only 数据权限。

当前鉴权是“共享同步密码 + HttpOnly cloud session”，不是完整用户账号系统。不要把它描述成用户级身份认证。

多表写入必须考虑原子性；餐食等多表写入优先使用事务 RPC。

## 9. Supabase / 数据库修改规则

DDL 必须通过 migration 执行，不要用临时 SQL 手改完就结束。

当前生产 schema 已存在，但早期 migration SQL 尚未完整回填到仓库，这是 roadmap 的 P0 技术债。新增数据库改动必须从现在开始做到：

1. migration 可追踪；
2. 权限 / RLS 一并审查；
3. service_role 能力最小化；
4. anon / authenticated 不应意外获得 server-only RPC；
5. 多表写入验证事务性；
6. 文档同步 `docs/03-data-model.md` / `04-api-and-sync.md`。

## 10. 云端同步安全规则

必须保留：

- 新设备首次写入保护；
- dirty local reload guard；
- HttpOnly cloud-session；
- server-side password validation；
- Supabase server-only access；
- local backup / JSON export 能力。

不要删除兼容 proxy 或旧内部函数名，除非已经同时迁移调用方并验证生产读取链路。

## 11. UI 规则

- 优先用 `components/ui/App*` wrapper；
- wrapper 不够时先确认 `animal-island-ui` 当前安装版本真实 API；
- 不凭想象臆造组件 props；
- 业务页面不应散落第二套按钮 / 卡片 / 弹窗视觉；
- 热力图日期仍按周六到周五完整周展示，跨月日期可读但弱化；
- UI 迁移已经完成，当前任务是维护，不再执行旧“全量迁移 phase”流程。

## 12. 测试规则

核心命令：

```bash
npm run test
npm run lint
npm run build
```

必须补测试的典型变化：

- 游戏结算 / 钱包 / 周规则；
- DailyRecord / ExchangeRecord / snapshot；
- 导入导出和 legacy migration；
- 热力图日期；
- 同步 guard；
- meal payload / API 语义；
- 数据库事务和权限发生变化时，应至少做 DB smoke test。

只改 Markdown / Skill 时可以不运行 build，但完成时必须明确说明。

## 13. 文档规则

当前有效文档只以 `docs/README.md` 索引的主文档为准。

每完成一个里程碑，应至少更新：

- `CHANGELOG.md`
- `docs/09-status-roadmap.md`
- 如果接口 / 数据 / 规则 / 架构变化，再更新对应主文档

不要再创建“xxx-after-refactor”“xxx-migration-report”“临时 audit”作为长期主文档。临时分析应放 PR / issue / 对话；稳定结论合并到主文档。

## 14. AI 执行规则

1. 先读真实代码和数据结构，不凭旧文档猜。
2. 先判断属于 game / nutrition / weight / sync / UI / infrastructure 哪个域。
3. 优先最小改动，禁止顺手大重构。
4. 不擅自安装依赖或改 package 配置。
5. 不删除兼容逻辑、用户数据或生产安全保护，除非任务明确要求且有迁移方案。
6. 不在输出或代码中暴露 secret。
7. 如果现状与文档冲突，以已验证的运行代码 / schema 为准，并同步修正文档。
8. 重大改动先给影响范围和回退路径。
9. 完成后说明：修改摘要、文件、验证、风险、未完成项。
10. git commit / push 由用户工作流决定；除非用户明确授权，不主动做不可逆仓库操作。
