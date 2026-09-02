---
name: couple-better-game-maintainer
description: >
  Ongoing maintenance and development skill for JIDAIN/couple_better_game.
  Use it for feature work, bug fixes, architecture changes, Supabase/API work,
  nutrition and weight features, game-rule changes, UI maintenance, testing,
  documentation updates, and production-safety reviews.
version: 2.2.1
---

# Couple Better Game Maintainer Skill v2.2.1

## Mission

持续维护「🐟和🐱变美变瘦大作战」当前真实架构，而不是重复执行已经完成的 UI 迁移。

目标是让每次修改同时满足：

```text
数据域不混淆
业务规则不漂移
云端数据不被误覆盖
secret 不进入浏览器或普通聊天
延续既有动森感 UI，不为新功能另造视觉体系
ChatGPT 未明确确认时绝不写餐食
同日数据按 partnerKey + date 关联展示，但不跨域偷改
UI / service / API / DB 分层清楚
修改可测试、可回滚、可文档化
```

## 1. 启动协议

开始任何任务前：

1. 阅读 `AGENTS.md`。
2. 阅读 `docs/README.md`。
3. 阅读 `docs/09-status-roadmap.md`，确认当前阶段。
4. 阅读任务对应主文档。
5. 阅读真实代码 / schema；文档与真实实现冲突时，不要猜，先确认运行事实。

任务分类：

```text
game       每日记录、金币、宝石、热力图、兑换
nutrition  餐食、摄入、foods/aliases、ChatGPT 记上
weight     体重时间序列、趋势
auth/sync  cloud session、快照、设备同步
ui         animal-island-ui、App* wrapper、页面交互
infra      Vercel、Supabase、migration、RLS
```

一个任务可能跨域，但每个数据写入必须明确属于哪个域。

## 2. 四域隔离铁律

### Intake

真实摄入只进入：

```text
meals
meal_items
foods / food_aliases（可选引用）
```

### Deficit

`deficit` 是现有游戏字段，只进入游戏记录。禁止：

- 把 meal total 当 deficit；
- 根据 intake 自动改 deficit；
- 把 deficit 文案改成“摄入热量”。

### Weight

`weight_measurements` 是体重趋势真相源。
`daily_record_sides.weight_kg` 只是当天游戏快照。

### Exercise

运动分钟是每日游戏事实；未来如果增加独立运动日志，要通过明确设计关联，不能悄悄改变现有字段含义。

### 同日关联展示

四个域可以、也应该在产品层按：

```text
partnerKey + date
```

关联展示。关联只用于同一天总览，不代表自动写回：

- meals 有数据、daily record 没数据时，deficit 显示“未记录”；
- daily record 有 deficit、meals 没数据时，摄入显示“未记录”；
- 不允许为了让页面“完整”而伪造另一域数据。

## 3. 游戏修改协议

修改游戏规则前必须读：

- `docs/05-business-rules.md`
- `lib/home/settlement-rules.ts`
- `lib/home/home-stat-service.ts`
- `lib/home/currency-semantics.ts`

不要凭 `gem` / `coin` 变量名判断用户可见含义。当前存在历史命名兼容层。

规则改动必须：

1. 修改纯函数 / service，而不是 JSX；
2. 更新边界值测试；
3. 验证历史记录回算；
4. 检查兑换余额影响；
5. 更新 `docs/05-business-rules.md` 和 roadmap/changelog。

## 4. Nutrition 修改协议

入口：

- `components/nutrition/**`
- `lib/nutrition/meal-service.ts`
- `lib/nutrition/meal-client.ts`
- `lib/nutrition/chatgpt-meal-protocol.ts`
- `lib/server/supabase-nutrition.ts`
- `app/api/meals/**`
- `supabase/migrations/20260901162337_add_chatgpt_meal_persistence_rpc.sql`
- `tests/nutrition/**`

保存餐食时：

- 保留 `rawName`；
- `foodId` 可以为空；
- 热量区间必须满足 min <= estimate <= max；
- 多明细写入使用事务；
- 重试路径必须考虑 `idempotencyKey`。

### Web 餐食协议

当前 Web 饮食 UI 已上线：

```text
#today notice-board
-> DailyMealsPanel
-> MealEditorModal
-> meal-client
-> /api/meals
-> Supabase
```

规则：

- 手动新增使用 `source = manual`；
- 编辑已有 ChatGPT/import 餐食保留原 source，除非有明确迁移；
- 浏览器只调用同源 Next.js API，不直接接 Supabase secret/service role；
- intake 不进入游戏 `HomeResourcesState`；
- 不为 ChatGPT 来源创建第二套 UI / 表。

### ChatGPT “记上”协议

ChatGPT 可以先讨论、修正、估算，但**不得因为已经给出估算就自动写数据库**。

明确保存确认后才执行：

```text
用户明确“记上”/“把这餐记下来”等保存意图
-> 构造最终 meal draft
-> 生成 chatgpt: idempotency key
-> create_chatgpt_meal_record
-> get_chatgpt_meal_record 读回
-> 成功后回复“已记上”
```

当前调用入口不是公开 HTTP API，而是用户已授权的 Supabase 连接能力。禁止把 `SUPABASE_SECRET_KEY`、service role key 或同步密码复制进聊天来实现 P2。

`create_chatgpt_meal_record`：

- service-role only；
- 强制 `source = chatgpt`；
- 强制 `status = confirmed`；
- 要求至少一个 item；
- 校验 item 名称、kcal 和区间；
- 整餐中心 kcal 必须等于 item 之和；
- 要求 `chatgpt:` 前缀 idempotency key；
- 对同 key 使用 transaction advisory lock；
- 最终仍复用 `create_meal_record` 和现有 `meals / meal_items`。

幂等规则：

```text
chatgpt:<partnerKey>:<mealDate>:<confirmationNonce>
```

- 一次明确确认只生成一个 key；
- 调用超时/结果不确定时，先 `get_chatgpt_meal_record(same key)`；
- 已存在则视为成功；
- 不存在才用 **same key** 重试；
- 不允许换新 key 盲目重试；
- 用户明确说“再记一顿”才新建 key。

当前角色映射：

```text
用户自己的饮食聊天 -> cat（猫猫）
鱼鱼的饮食聊天     -> fish（鱼鱼）
```

上下文不明确时不能猜测后写入；如果用户在当前对话中明确声明角色，以当前明确声明为最高优先级。

已经成功写入后，普通事实补充不自动改库；需要明确更新意图。P2 首版自动持久化入口负责新增，已有餐食仍可从 Web UI 编辑/删除。

无论任何 ChatGPT 餐食写入：

```text
不写 deficit
不写 exercise
不写 weight
不写 wallet / ledger
不写金币/宝石
不写 heatmap
```

## 5. Weight 修改协议

- 趋势读取以 `weight_measurements` 为准。
- 从旧每日打卡录入体重时，可做事务性 dual-write，但必须保证失败一致性。
- 同一天多个测量值允许保留；“每日展示值”由 view / service 定义，不覆盖历史测量。

## 6. API / Sync 修改协议

浏览器不能直接持有数据库高权限凭证。

必须保持：

```text
Browser -> Next.js API -> server helper -> Supabase RPC/Table
```

ChatGPT P2 例外是受授权的非浏览器连接路径：

```text
ChatGPT -> authorized connector -> service-only meal RPC -> Supabase
```

### 禁止

- `NEXT_PUBLIC_SUPABASE_SECRET_KEY`
- service role / secret key 写前端
- service role / secret key / 同步密码复制进普通聊天
- 为 ChatGPT 新增匿名写 API
- 公开 `/api/home-data`
- 公开 GitHub JSON 用户数据镜像
- 新设备首次连接直接上传本地空快照
- 日常“记上”路径使用任意 SQL 去修改游戏/钱包表

### 兼容同步

Provider 仍使用旧内部命名和 `/data/couple-data.json` 兼容请求；`proxy.ts` 在有效 cloud session 下重写到 `/api/home-data`。

在没有完成调用方迁移和生产验证前，不要删除这个 shim。

## 7. Supabase 修改协议

production migrations 持续纳入：

```text
supabase/migrations/
```

新增 / 修改 DDL：

1. 使用新 migration；
2. migration 纳入仓库版本控制；
3. **不得回头修改已经执行的历史 migration**；
4. 审查 RLS / grants；
5. server-only RPC 不给 anon/authenticated；
6. 多表操作优先 transaction RPC；
7. production smoke test 后清理测试数据；
8. 更新数据模型和 API / 安全文档。

migration 管数据库结构和规则，不等于 production 业务数据备份。数据库维护细节以 `supabase/README.md` 为准。

## 8. UI 修改协议

当前 UI migration 已完成。维护规则：

- 先复用 `components/ui/App*`；
- 再查看当前安装的 `animal-island-ui` API；
- 不臆造 props / variants；
- 不在业务页面创建第二套按钮、卡片、Modal 风格；
- fallback 必须有明确“官方组件无法承载”的理由；
- CSS 主要负责布局、safe-area、业务专有可视化，不重画官方 primitive。

### 当前主导航约束

底部主导航当前固定为：

```text
今日 / 地图 / 兑换 / 小窝
```

饮食功能当前属于 `#today` notice-board，并使用 `AppSectionPanel` 承载。普通营养功能迭代**不得因为模块变多就擅自增加第五个 Tab**。

只有用户明确要求信息架构调整，或现有场景经产品审查确认无法承载时，才重新设计主导航。

### 当前饮食 UI 视觉组合

优先延续：

```text
AppSectionPanel
AppCard
AppButton
AppInput
AppTextarea
AppModal
AppRoleAvatar
animal-island-ui Title
```

大型视觉变更才需要重新做 UI audit；普通功能不要启动旧 migration phase/checkpoint 流程。

## 9. Provider 与 storage 协议

`HomeResourcesProvider` 是**游戏**编排器，不是所有新领域的全局状态容器。

业务游戏快照通过 `AppDataStore` 读写。

当前 Provider / DataManagement 对同步元数据、同步密码的 localStorage/sessionStorage 直接访问属于兼容债务；新功能不要复制这种模式。

饮食 UI 当前直接通过 meal API 读取 Supabase，不应为了“统一状态”把 meals 再塞入 HomeResourcesProvider/localStorage snapshot。

如果 Provider 改动 > 约 50 行，优先拆到：

```text
lib/home service
lib/nutrition service / browser client
lib/server
独立 browser client/service
```

## 10. 验证矩阵

| 改动 | 最低验证 |
|---|---|
| 纯文档 / Skill | 链接、事实、路径人工检查 |
| game pure rules | targeted Vitest + `npm run test` |
| snapshot / import / sync | 对应 tests + build |
| API TypeScript | build + auth/error path |
| Supabase RPC | DB CRUD smoke + permission check + cleanup |
| nutrition validation/client | `tests/nutrition` + build |
| ChatGPT persistence | protocol tests + DB idempotency smoke + read-back + grants + cleanup |
| UI | test/lint/build；条件允许时做关键移动端交互 smoke |
| production sync | Vercel READY + 真实读取/写入证据 |

能运行时，提交前执行：

```bash
npm run test
npm run lint
npm run build
```

无法运行某项时必须明确说明，不得写“已验证”。

**Test/Lint/Build 通过不等于视觉已验证。** 如果没有真实浏览器/手机视觉检查，完成说明必须明确这一点。

## 11. 文档同步协议

长期主文档只有 `docs/README.md` 索引中的文件。

完成里程碑后：

1. `CHANGELOG.md` 记完成事实；
2. `docs/09-status-roadmap.md` 移动状态；
3. 接口 / schema / 规则 / 安全 / UI / 架构发生变化时更新对应主文档；
4. 不新增长期 `*-after-refactor.md` / `*-migration-report.md` / `*-audit.md`。

## 12. 完成前检查

```text
[ ] 没有混淆 intake / deficit / weight / exercise
[ ] 同日总览按 partnerKey + date 关联，但没有跨域自动覆盖
[ ] 没有把 secret 放入浏览器或普通聊天
[ ] 没有恢复 public GitHub data
[ ] 没有绕过新设备保护
[ ] 没有凭 legacy 变量名误改 currency
[ ] ChatGPT 未确认时没有写 meal
[ ] ChatGPT 重试复用了同一 idempotency key
[ ] ChatGPT 角色映射遵循当前明确声明：用户=cat，鱼鱼=fish
[ ] 多表写入考虑事务
[ ] 派生数据可以从事实重算
[ ] UI 延续现有 App* / animal-island-ui 体系
[ ] 未擅自改变四 Tab 主导航
[ ] 必需测试已补
[ ] 文档状态已同步
[ ] 测试 / lint / build 的真实执行情况已说明
[ ] 未把 CI 通过误写成“视觉已验证”
```

## 13. 输出格式

完成任务用中文报告：

1. 做了什么；
2. 为什么这样做；
3. 修改文件 / migration；
4. 验证证据；
5. 数据或安全风险；
6. 未完成项和 roadmap 下一步。