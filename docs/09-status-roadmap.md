# 当前状态与 Roadmap

**状态日期：2026-09-02**

这份文件是“现在做到哪一步、下一步做什么”的唯一主状态页。

## 1. 当前生产状态

`main` 已完成 V2-P0 和 V2-P1，但生产根 `/` 仍显示成熟的双人健康游戏；旧游戏没有被删除。

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
+ mood / sleep / activity facts + Life API
+ 通用 AI record write protocol 基础
```

已完成：

```text
P0 工程治理                         ✅
P1 今日饮食 UI                      ✅
P2 ChatGPT “记上”                   ✅
P2.5 同日饮食 + 游戏记录            ✅
V2-P0 新旧系统边界                  ✅
V2-P1 Life facts + API + AI 基础    ✅
```

## 2. V2 当前阶段

当前里程碑不是直接进入完整首页，而是插入一个短阶段：

```text
V2-UI0 — 岛屿生活视觉基础 / UI reuse foundation
```

开发分支：

```text
v2/ui-foundation
```

原因：V2 后续会覆盖首页、饮食、日历、体重、药箱、信箱等多种信息密度。仅依赖当前 lockfile 中的 `animal-island-ui 1.0.1` 不足以支撑完整产品，但从不同 GitHub 项目直接搬 UI 又会导致视觉割裂。

因此先建立统一 Design System、复用规则和 `/ui-lab`，再接 Life API。

详细规则见 `docs/12-island-life-design-system.md`。

## 3. V2-UI0 当前实施内容

目标：

- [x] 建立 `docs/12-island-life-design-system.md`；
- [x] 建立 `/ui-lab`，明确只用于视觉实验，不读写真实数据；
- [x] 首页三种核心 Pattern 的交互预览：Mood / Sleep / Activity；
- [x] 小窝功能入口的主题浓度预览；
- [x] 明确开源 UI 复用优先级和视觉适配边界；
- [x] 确认当前 lockfile 实际仍为 `animal-island-ui 1.0.1`；
- [x] 确认上游 1.8.x 已扩展到 DatePicker / TimePicker / Drawer / Tabs / Table / Tag / Notification / Progress / Skeleton / Image / Carousel 等更完整组件；
- [ ] 对当前 App* wrapper 做 1.8.x 兼容性矩阵；
- [ ] 决定哪些 1.8.x 新组件值得增加项目 wrapper；
- [ ] Test / Lint / Build；
- [ ] Vercel Preview 打开 `/ui-lab` 做真实视觉检查；
- [ ] 人工确认主题浓度后，才决定依赖升级并进入 V2-P2。

本阶段不改 Supabase schema，不改旧游戏规则，不把实验页作为正式导航。

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

V2 Life 已有：

```text
mood_entries
sleep_records
activity_entries
record_write_receipts
```

生活系统中的“活动”是统一用户概念，不在首页拆成学习 / 运动 / 散步等多个任务；数据库保留 `activity_type / duration_minutes` 作为可选结构化字段，手动 UI 不强迫填写，未来 AI 可以在明确事实基础上填充。

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

`lib/ai/record-write-protocol.ts` 已预留：

```text
meal / mood / sleep / activity / weight / medicine
```

AI 不获得任意 SQL 权限。未来每个领域继续拥有自己的字段校验、权限和审计规则。

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

因此饮食已经从旧游戏 Provider 中拆出来，但产品层目前仍在旧游戏今日页展示；未来独立饮食页直接复用 `DailyMealsPanelCore`。

## 8. UI 复用规则

新增可见 UI 的默认顺序：

```text
已有 App*
↓
animal-island-ui 官方能力
↓
同风格且许可允许的成熟 GitHub Pattern
↓
成熟 headless / 通用库的交互能力
↓
项目原创组件
```

外部项目的视觉不能直接进入业务层。异风格项目只借交互、布局和数据组织；颜色、圆角、阴影、Button/Input/Card 等必须重新归一到项目 Design System。

当前重点参考：

```text
guokaigdg/animal-island-ui
TIUCSIB/animal-island-blog
AshleyCry/AnimalIslandNewTab
guowenju/portal-os
CheapNightbot/our-days
```

## 9. 饮食后续

现有 Meal CRUD / ChatGPT “记上”继续有效。

独立阶段会把：

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

## 10. 家庭药箱后续

家庭药箱作为独立数据域；收到真实 Excel 后再确定最终 schema 和导入字段。

未来目标包括：药名 / 规格 / 数量 / 存放位置、保质期 / 开封后有效期、状态与软删除、source / idempotency、AI 受限查询与确认后修改、change log / audit。

真实 Excel 和真实家庭库存数据不得提交到 GitHub migration。

## 11. 后续顺序

```text
V2-P0  新旧边界 + /game + 解耦             ✅
↓
V2-P1  心情 / 睡眠 / 活动 schema + API      ✅
↓
V2-UI0 岛屿生活 Design System + /ui-lab     🚧
↓
V2-P2  新生活主框架 + 今日首页
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

## 12. 工程和安全规则

继续保持：

```text
Browser -> Next.js API -> server-only Supabase -> PostgreSQL
```

- Supabase secret 不进入浏览器；
- 生产 DDL 只通过新 migration；
- 旧 migration 不回改；
- Web / ChatGPT / import 最终复用同一领域事实；
- 外部写入必须使用稳定幂等键；
- 每个阶段至少执行 Test / Lint / Build，并通过 Vercel Preview 检查；
- `/ui-lab` 不得读写真实生活数据或修改 Legacy Game settlement。

## 13. 下一步是什么

当前下一步是完成 V2-UI0：

```text
App* -> animal-island-ui 1.8.x 兼容矩阵
+ 新官方组件包装候选
+ CI / Preview
+ /ui-lab 人工视觉确认
```

确认后再进入 V2-P2，把已经存在的 Life API 接到正式「今日」页面。
