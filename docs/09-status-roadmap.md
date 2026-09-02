# 当前状态与 Roadmap

**状态日期：2026-09-02**

这份文件是“现在做到哪一步、下一步做什么”的唯一主状态页。

## 1. 当前生产状态

`main` 已完成 V2-P0 基础边界，但生产根 `/` 仍显示成熟的双人健康游戏；旧游戏没有被删除。

当前生产能力包括：

```text
双人游戏前端
+ localStorage 游戏运行缓存
+ Supabase 云端主数据
+ Next.js 安全 API
+ 今日饮食 Web UI
+ ChatGPT 明确确认后的餐食持久化
+ P2.5 同日饮食 / 游戏记录关联展示
+ /game 旧游戏稳定入口
+ provider-free DailyMealsPanelCore
```

已完成：

```text
P0 工程治理                 ✅
P1 今日饮食 UI              ✅
P2 ChatGPT “记上”           ✅
P2.5 同日饮食 + 游戏记录    ✅
V2-P0 新旧系统边界          ✅
```

## 2. V2 当前阶段

当前里程碑：

```text
V2-P1 — Life records / 心情、睡眠、活动数据与 API
```

目标不是先画新首页，而是先建立可长期复用的事实层：

```text
Life UI / future ChatGPT / future import
                 ↓
        canonical domain validation
                 ↓
       Next.js API / restricted RPC
                 ↓
              Supabase
```

详细产品边界见：

```text
docs/10-v2-life-redesign.md
```

## 3. V2-P1 当前实施内容

当前开发分支：

```text
v2/life-records
```

已完成代码：

- [x] `mood_entries` schema；
- [x] `sleep_records` schema；
- [x] `activity_entries` schema；
- [x] `record_write_receipts`：为 ChatGPT / import 等外部写入提供跨领域幂等回执基础；
- [x] Life RPC：按日读取、心情 upsert、睡眠 upsert、活动新增/修改/软删除；
- [x] `lib/life/life-service.ts` 类型与输入校验；
- [x] `lib/server/supabase-life.ts` 服务端 Supabase 边界；
- [x] `/api/life/day`；
- [x] `/api/life/mood`；
- [x] `/api/life/sleep`；
- [x] `/api/life/activities`；
- [x] `/api/life/activities/[id]`；
- [x] `lib/life/life-client.ts` 浏览器 client；
- [x] `lib/ai/record-write-protocol.ts` 通用 AI 写入协议基础；
- [x] life / AI protocol 单元测试；
- [x] Vercel Preview build READY；
- [ ] GitHub CI 最终通过；
- [ ] migration 在 production Supabase 应用并 smoke test；
- [ ] 合并 V2-P1。

本阶段仍不切换根 `/`，不开发最终首页视觉。

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

已有事实域继续保持：

```text
intake    -> meals / meal_items
deficit   -> daily_record_sides.deficit_kcal
weight    -> weight_measurements
exercise  -> daily_record_sides.exercise_minutes（旧游戏）
```

V2 Life 新事实域：

```text
mood_entries
sleep_records
activity_entries
```

生活系统中的“活动”是统一用户概念，不在首页拆成学习 / 运动 / 散步等多个任务；数据库保留 `activity_type` / `duration_minutes` 作为可选结构化字段，手动 UI 不强迫填写，未来 AI 可以在明确事实基础上填充。

`record_write_receipts` 不是生活事实本身，而是外部写入幂等/审计基础。它预留 domain：

```text
meal / mood / sleep / activity / weight / medicine
```

## 6. AI 写入架构原则

以后不是“饮食单独接一个 AI、药箱再单独造一个 AI”。统一遵循：

```text
用户自然语言 / 图片
↓
对话层理解与草稿
↓
用户明确确认保存/修改
↓
通用 ChatGPT idempotency key
↓
领域专属 prepare + validation
↓
领域专属 canonical write service / restricted RPC
↓
read-back
↓
确认成功
```

`lib/ai/record-write-protocol.ts` 已定义统一 domain 与幂等键格式，但**没有提供任意 SQL 写入口**。

未来可逐步接入：

- 饮食；
- 心情；
- 睡眠；
- 活动；
- 体重；
- 家庭药箱。

每个领域仍拥有自己的字段校验、权限和写入规则。

## 7. 旧游戏边界

旧游戏继续完整保留：

- deficit；
- 运动分钟；
- 游戏体重快照；
- 金币 / 宝石；
- 成长地图；
- 兑换商店与兑换历史；
- 成长日志；
- 原有同步 / 备份机制。

代码仍主要位于：

```text
components/home
lib/home
HomeResourcesProvider
```

V2 不把 `HomeResourcesProvider` 扩大为生活系统全局 Provider。

饮食已经完成代码级拆分：

```text
DailyMealsPanel            旧游戏适配层；读取 HomeResourcesProvider
└─ DailyMealsPanelCore     纯饮食 UI；不读取 HomeResourcesProvider
```

因此“饮食已经从旧游戏 Provider 中拆出来”，但**产品层目前仍在旧游戏今日页展示**；未来独立饮食页直接复用 `DailyMealsPanelCore`。

## 8. 饮食后续

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

## 9. 家庭药箱后续

家庭药箱作为独立数据域；收到真实 Excel 后再确定最终 schema 和导入字段。

未来目标包括：

- 药名 / 规格 / 数量 / 存放位置；
- 保质期 / 开封后有效期；
- 状态与软删除；
- source / idempotency；
- AI 受限查询与确认后修改；
- change log / audit。

药箱 AI 写入将复用通用 AI 写入协议和 `record_write_receipts` 思路，而不是获得通用数据库写权限。

真实 Excel 和真实家庭库存数据不得提交到 GitHub migration。

## 10. 后续顺序

```text
V2-P0  新旧边界 + /game + 解耦          ✅
↓
V2-P1  心情 / 睡眠 / 活动 schema + API   🚧
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

AI 不单独作为一个“最后阶段”；每个事实域具备稳定 canonical API 后，可按需要逐步增加 AI adapter。

## 11. 工程和安全规则

继续保持：

```text
Browser -> Next.js API -> server-only Supabase -> PostgreSQL
```

ChatGPT 路径继续是受授权的非浏览器路径，必须受限到领域写入接口。

- Supabase secret 不进入浏览器；
- 生产 DDL 只通过新 migration；
- 旧 migration 不回改；
- Web / ChatGPT / import 最终复用同一领域事实；
- AI 不获得通用 SQL 修改游戏 / 钱包 / 药箱的权限；
- 外部写入必须使用稳定幂等键；
- 结果不确定时先 read-back / 查回执，再用同 key 重试；
- 每个阶段至少执行 Test / Lint / Build，并通过 Vercel Preview 检查。

## 12. 旧兼容债

以下继续保留为 Later：

- `reloadFromGitHub / syncToGitHub` legacy 命名；
- `/data/couple-data.json` proxy shim；
- sync metadata storage 技术债；
- 完整 Supabase Auth / membership；
- server-authoritative 游戏结算。

## 13. 下一步是什么

先完成 V2-P1 的 CI、Supabase additive migration 和 smoke test。

通过后进入：

```text
V2-P2
-> 新生活主框架
-> 今日只显示心情 / 睡眠 / 活动
-> 暂时不把饮食、体重、药箱、信箱塞回首页
```
