# 当前状态与 Roadmap

**状态日期：2026-09-01**

这份文件是“现在做到哪一步、下一步做什么”的唯一主状态页。

## 1. 当前阶段

项目已经从 localStorage-only MVP 演进为：

```text
成熟的游戏前端
+ localStorage 游戏运行缓存
+ Supabase 云端主数据
+ Next.js 安全 API
+ 营养后端
+ 今日饮食 Web UI
```

2026-09-01 的项目治理、P0 工程基线和 P1 饮食 Web 首版已经完成。当前下一阶段是 **P2：ChatGPT “记上”持久化流程**。

## 2. 功能进度

| 模块 | 状态 | 说明 |
|---|---|---|
| 每日双人打卡 | ✅ 完成 | deficit / exercise / weight snapshot |
| 游戏结算 | ✅ 完成 | 当前规则前端 service 计算 |
| 历史补录 / 编辑 / 删除 | ✅ 完成 | 会重算派生状态 |
| 月度成长地图 | ✅ 完成 | 周六到周五，跨月真实记录 |
| 成长日志 | ✅ 完成 | 查看和管理历史 |
| 兑换商店 | ✅ 完成 | 分类、兑换、历史记录 |
| JSON 备份 / 恢复 | ✅ 完成 | schemaVersion 1 + currency semantics 兼容 |
| 周复盘 CSV | ✅ 完成 | 只导出 |
| animal-island-ui 视觉体系 | ✅ 完成 | App* wrapper 已建立并持续维护 |
| Supabase 规范化 schema | ✅ 完成 | 12 条 production migration 已回填 Git |
| Supabase schema 版本管理 | ✅ 完成 | `supabase/migrations/` 为结构变更历史 |
| 游戏云端读取 / 写入 | ✅ 完成 | Supabase-only 主路径 |
| 新设备首次连接保护 | ✅ 完成 | download-before-write |
| 公开 GitHub JSON 退出 | ✅ 当前代码完成 | GitHub cached view 清理待 Support |
| Nutrition schema | ✅ 完成 | meals/items/foods/aliases |
| Meal CRUD API | ✅ 完成 | transaction RPC，已 smoke test |
| Meal Web UI | ✅ 完成 | 今日公告板内按日期/角色 CRUD + 明细 |
| ChatGPT “记上”持久化流程 | ⏳ 当前下一步 | 需以明确确认触发 |
| Weight schema | ✅ 完成 | `weight_measurements` 已存在 |
| Weight API / trend UI | ⏳ 未开始 | ChatGPT 饮食流程之后开发 |
| Goal period schema | ✅ 完成 | UI 未实现 |
| 完整用户账号 / membership | ⏳ Later | 当前只共享密码/session |
| Server-authoritative 游戏结算 | ⏳ Later | 当前服务端保存兼容快照，不独立重算规则 |

## 3. 2026-09-01 治理与 P0 完成项

### 文档 / AI 规则

- [x] 重写 README，使项目当前架构一眼可见。
- [x] 重写 AGENTS / CLAUDE，移除“无后端/无数据库”旧假设。
- [x] 用持续维护 Skill 替换旧 UI migration Skill 思路。
- [x] 把 30+ 份重复 docs 合并为 9 份主文档 + 索引。
- [x] 将 GitHub JSON、future API 草案、future DB 草案从当前事实文档移除。
- [x] 把 live Supabase、Meal API、云端同步安全写入主文档。
- [x] 校正恢复奖励、heatmap、currency semantics 等旧文档错误。

### Supabase 可重建性

- [x] 从 production `supabase_migrations.schema_migrations` 恢复原始 migration SQL。
- [x] 建立 `supabase/migrations/`，按原 version / name 保存 12 条 migration。
- [x] 建立 `supabase/README.md`，明确 migration、RLS、secret 与重建规则。
- [x] 验证当前 production 公共业务表均启用 RLS。
- [x] 验证当前没有向 `anon` / `authenticated` 开放业务 policy。
- [x] 验证当前业务 RPC 只授权服务端 `service_role`。
- [x] 确认 `coin_deficit_streak_days` 已通过历史 migration 从初始默认 7 修正为 5；当前 production default 也是 5。

注意：migration 负责数据库结构，不包含当前真实情侣业务数据。结构可重建不等于 production 数据备份。

### 工程 baseline

GitHub Actions 已建立：

```text
npm run test
npm run lint
npm run build
```

P0 基线检查结果：

```text
Test  ✅
Lint  ✅
Build ✅
```

期间发现并修复一个旧兑换记录兜底时间的跨时区测试问题：缺失时间不再使用会被本地时区转换的 `...Z` UTC 占位，而使用确定的本地 `1970-01-01T00:00` 占位。正常有时间的兑换记录不受影响。

## 4. P1 — 今日饮食 UI（已完成）

### 4.1 产品落点

饮食功能没有增加第五个底部 Tab，而是继续放在现有：

```text
#today
-> notice-board
-> AppSectionPanel「饮食小记」
```

这样保持当前动物岛公告板的信息架构和视觉语言。

### 4.2 已实现

- [x] 按日期查看当天饮食；
- [x] fish / cat 明确切换；
- [x] 显示早餐、午餐、晚餐、加餐、其他；
- [x] 每餐显示中心估算与可用区间，如 `520 kcal（480–570）`；
- [x] 展开查看 food items；
- [x] 显示已有 optional macro 信息；
- [x] 当天餐数 + kcal 合计；
- [x] Web 手动新增餐食；
- [x] 编辑已有餐食；
- [x] 删除确认 + 软删除；
- [x] loading / empty / unauthorized / retry / toast 状态；
- [x] 使用现有 `/api/meals` 和 `/api/meals/[id]`；
- [x] 新增 `lib/nutrition/meal-client.ts`，浏览器只请求同源 Next.js API；
- [x] 使用现有 `AppSectionPanel / AppCard / AppButton / AppInput / AppTextarea / AppModal / AppRoleAvatar`；
- [x] 不引入第二套 UI primitive；
- [x] 不把 intake 自动写入 deficit / wallet / heatmap。

### 4.3 文件落点

```text
components/nutrition/DailyMealsPanel.tsx
components/nutrition/MealEditorModal.tsx
lib/nutrition/meal-client.ts
tests/nutrition/meal-client.test.ts
```

`components/home/HomeScreen.tsx` 只负责把 `DailyMealsPanel` 插入 today notice-board，没有重新设计主导航。

### 4.4 验证边界

代码级验证使用 CI：

```text
Test / Lint / Build
```

UI 实际观感仍应在真实手机/浏览器上人工检查。没有做过真实视觉检查时，不把“CI 通过”等同于“视觉已验证”。

## 5. P2 — ChatGPT “记上”流程（当前下一步）

目标行为：

```text
发食物图片/描述
-> ChatGPT 讨论估算
-> 用户修正
-> 用户明确“记上”
-> 构造 source=chatgpt meal payload
-> 带 idempotency key 写入
-> 成功后可查询确认
-> 今日饮食 UI 自动能看到同一条 meal 数据
```

铁律：

- 未确认不写；
- 不把 intake 写成 deficit；
- 不碰游戏钱包；
- 重试不重复建餐；
- 复用现有 `meals / meal_items` 和 meal API/RPC，不建立 AI 专用第二套表；
- fish 对应当前用户饮食聊天，cat 对应伴侣专用饮食聊天时必须明确上下文映射。

### P2 实施前要先明确

- ChatGPT 到 meal API 的授权/调用入口；
- idempotency key 生成规则；
- “记上”确认边界和修改后再确认的行为；
- 写入成功后的查询验证和失败反馈；
- 不把聊天中的临时估算、历史讨论自动导入。

## 6. P3 — 体重趋势

目标：

- `weight_measurements` CRUD/API；
- 当前体重和趋势折线；
- 同日多次测量策略；
- 旧每日打卡 weight snapshot 与 measurement 的事务性关联；
- 后续 daily overview 使用真实 measurement summary。

## 7. P4 — 统一每日总览

基于已有 views：

```text
daily_nutrition_summary
daily_weight_summary
partner_daily_overview
```

展示：

- 实际摄入；
- 体重；
- 游戏 deficit；
- 运动；
- 当日游戏奖励。

四个域并列展示，但不互相偷偷改值。

## 8. P5 / Later — 架构强化

### 游戏结算服务端权威化

前端仍可 preview，但服务端根据原始输入重算最终 reward/wallet。

### 真正用户身份

如果项目从两人私人应用扩展：

- User/Auth
- CoupleSpace membership
- per-user authorization
- RLS policy
- device/session revoke
- conflict strategy

### 清理兼容债

在有测试和生产迁移证明后：

- rename `reloadFromGitHub / syncToGitHub`；
- 移除 `/data/couple-data.json` proxy shim；
- 统一 cloud-session helper；
- 把 sync metadata storage 从组件/Provider 抽出。

不要在业务功能中顺手做这些迁移。

## 9. 外部事项

### GitHub cached views

GitHub Support `Clear Cached Views` 工单已创建。等待平台完成后：

1. 测试旧 sensitive commit/blob URL；
2. 应返回不可访问/404；
3. 记录完成时间到 CHANGELOG；
4. 再评估是否还有 Vercel 历史 deployment 残留。

## 10. “下一步是什么”的简单答案

当前：

```text
P0 工程治理        ✅
P1 今日饮食 UI     ✅
↓
P2 ChatGPT “记上”  当前下一步
↓
P3 体重趋势
↓
P4 统一每日总览
```

除非用户改变优先级，以这个顺序推进。
