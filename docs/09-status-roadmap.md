# 当前状态与 Roadmap

**状态日期：2026-09-02**

这份文件是“现在做到哪一步、下一步做什么”的唯一主状态页。

## 1. 当前生产状态

当前 `main` / production 仍然是成熟的双人健康游戏：

```text
双人游戏前端
+ localStorage 游戏运行缓存
+ Supabase 云端主数据
+ Next.js 安全 API
+ 今日饮食 Web UI
+ ChatGPT 明确确认后的餐食持久化
+ P2.5 同日饮食 / 游戏记录关联展示
```

截至 V2 重构开始前：

```text
P0 工程治理                 ✅
P1 今日饮食 UI              ✅
P2 ChatGPT “记上”           ✅
P2.5 同日饮食 + 游戏记录    ✅
```

旧 roadmap 中的“P3 体重趋势”不再作为当前直接下一步；用户已经明确改变产品优先级，进入 V2 生活系统重构。

## 2. V2 当前阶段

当前里程碑：

```text
V2-P0 — Life foundation / 新旧模块边界
```

目标不是删除旧游戏，而是改变它在整个产品中的位置：

```text
生活系统成为主产品
└─ 小窝 / 游戏机
   └─ 变美变瘦大作战（完整保留）
```

详细设计见：

```text
docs/10-v2-life-redesign.md
```

## 3. V2-P0 — 当前实施内容

- [x] 从稳定生产 HEAD 建立 `v2/life-foundation` 分支；
- [x] 新增 `/game` 路由，继续渲染现有完整 `HomeScreen`；
- [x] 根 `/` 暂时不切换，避免在新生活首页未完成前影响生产逻辑；
- [x] 建立 `components/life/LifeAppShell.tsx` 作为新生活系统代码边界；
- [x] GitHub CI Node 版本由 20 对齐到 Vercel production 的 Node 24；
- [ ] 把纯饮食 UI 对 `HomeResourcesProvider` 的直接依赖移到旧游戏适配层；
- [ ] Vercel Preview 验证 `/` 与 `/game` 都可正常运行；
- [ ] CI Test / Lint / Build 全部通过后再考虑合并。

V2-P0 不改 Supabase schema，不改游戏规则，不改兑换机制。

## 4. V2 目标信息架构

```text
今日
├─ 心情
├─ 睡眠
└─ 活动

饮食

日历

小窝
├─ 体重
├─ 日记 / 小信箱
├─ 家庭药箱
├─ 心情月度回顾（Later）
├─ 游戏机
│  ├─ 变美变瘦大作战
│  └─ Future Mini Games
└─ 数据管理
```

首页不放饮食、体重、给对方的话或家庭药箱；高频首页只保留心情、睡眠和活动。

## 5. 数据边界

当前已有事实域继续保持：

```text
intake    -> meals / meal_items
deficit   -> daily_record_sides.deficit_kcal
weight    -> weight_measurements
exercise  -> daily_record_sides.exercise_minutes（旧游戏）
```

V2 预计新增：

```text
mood_entries
sleep_records
activity_entries
```

生活系统中的“活动”是统一用户概念，不在首页拆成学习 / 运动 / 散步等多个任务；数据库可为未来 AI 结构化保留可选类型和时长字段。

## 6. 旧游戏边界

旧游戏继续完整保留：

- deficit；
- 运动分钟；
- 游戏体重快照；
- 金币 / 宝石；
- 成长地图；
- 兑换商店与兑换历史；
- 成长日志；
- 原有同步 / 备份机制。

当前代码仍位于：

```text
components/home
lib/home
HomeResourcesProvider
```

V2 不把 `HomeResourcesProvider` 扩大为生活系统全局 Provider。

## 7. 饮食后续

现有 Meal CRUD / ChatGPT “记上”继续有效。

后续独立阶段会把：

```text
meals.total_calories_kcal
meal_items.calories_kcal
```

从强制值改成可选值，并同步更新 Web validation、RPC、汇总 view、ChatGPT protocol 和测试。

必须保持：

```text
NULL = 没有估算
0    = 确实为 0 kcal
```

这项数据库修改不与 V2-P0 混在一起。

## 8. 家庭药箱后续

家庭药箱将作为独立数据域；收到真实 Excel 后再确定最终 schema 和导入字段。

未来目标包括：

- 药名 / 规格 / 数量 / 存放位置；
- 保质期 / 开封后有效期；
- 状态与软删除；
- `source` / `idempotency_key`；
- AI 受限查询与确认后修改；
- 必要的 change log / audit。

真实 Excel 和真实家庭库存数据不得提交到 GitHub migration。

## 9. 后续顺序

```text
V2-P0  新旧边界 + /game + 解耦
↓
V2-P1  心情 / 睡眠 / 活动 schema + API
↓
V2-P2  新生活首页
↓
V2-P3  饮食独立页 + kcal optional
↓
V2-P4  生活日历
↓
V2-P5  真实体重页
↓
V2-P6  家庭药箱
↓
V2-P7  日记 / 小信箱
↓
Later   月度双人心情图 / Mini Games / 动物岛生活可视化
```

## 10. 工程和安全规则

继续保持：

```text
Browser -> Next.js API -> server-only Supabase -> PostgreSQL
```

- Supabase secret 不进入浏览器；
- 生产 DDL 只通过新 migration；
- 旧 migration 不回改；
- Web / ChatGPT / import 最终应复用同一领域事实和受限写入逻辑；
- AI 不获得通用 SQL 修改游戏 / 钱包 / 药箱的权限；
- 每个阶段至少执行 Test / Lint / Build，并通过 Vercel Preview 检查。

## 11. 旧兼容债

以下继续保留为 Later，不在普通 V2 业务开发中顺手清理：

- `reloadFromGitHub / syncToGitHub` legacy 命名；
- `/data/couple-data.json` proxy shim；
- sync metadata storage 技术债；
- 完整 Supabase Auth / membership；
- server-authoritative 游戏结算。

## 12. 下一步是什么

当前直接继续完成：

```text
V2-P0
-> 解耦 DailyMealsPanel 与 HomeResourcesProvider
-> Vercel Preview / CI 验证
```

Supabase 当前保持不变。
