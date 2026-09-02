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
V2-UI0 视觉语言设计与人工确认        ✅
```

## 2. V2 当前阶段

统一视觉语言已经定稿：

```text
docs/12-island-life-design-system.md
```

这是 V2 后续可见 UI 的唯一主视觉规范。

开发分支：

```text
v2/ui-foundation
```

人工确认的核心方向：

- 采用「方案 B」暖白 + 薄荷/青绿 + 柔黄/珊瑚/浅蓝；
- 不再使用大面积棕色；
- 首页保持心情 / 睡眠 / 活动，并为三者都提供记录入口；
- 心情使用彩色情绪圆脸，不使用人物头像；
- 活动人物当前只允许临时女性动森风角色，后续由用户提供双方真实动森角色替换；
- 饮食独立页面，顶部 `我 / Ta` 切换，不做双人同屏对照；
- 饮食每餐左侧真实照片、右侧碳水/蛋白质/脂肪/总热量；
- 日历保持已确认的双人心情月历；
- 小窝保持体重 / 小信箱 / 家庭药箱 / 游戏机四入口；
- 体重页也使用 `我 / Ta`；
- 小信箱不使用头像列表；
- 游戏机只做到游戏列表，本轮不做游戏详情页；
- 当前唯一游戏是旧版「宝石金币游戏」，未来预留更多游戏接口。

## 3. V2 信息架构（定稿）

主导航：

```text
今日 / 饮食 / 日历 / 小窝 / 我的
```

页面结构：

```text
今日
├─ 心情
├─ 睡眠
└─ 活动

饮食
└─ 编辑一餐

日历
└─ 日历详情

小窝
├─ 体重
├─ 小信箱
├─ 家庭药箱
│  └─ 添加 / 编辑药品
└─ 游戏机
   ├─ 宝石金币游戏 -> Legacy Game
   └─ Future Games

我的
└─ 账号/设置/数据等后续入口
```

游戏机本轮只开发游戏列表，不开发新的游戏详情 UI。

## 4. 数据边界

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

## 5. AI 写入架构原则

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

因此饮食已经从旧游戏 Provider 中拆出来；V2 独立饮食页应复用/重构 `DailyMealsPanelCore`，而不是重建第二套 Meal CRUD。

## 7. UI 复用规则

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

后续实现必须以 `docs/12-island-life-design-system.md` 为视觉规范源；`/ui-lab` 只是实验工具。

## 8. 饮食后续

独立饮食页定稿结构：

```text
顶部：我 / Ta
早餐：左真实照片，右营养统计 + 编辑
午餐：左真实照片，右营养统计 + 编辑
晚餐：左真实照片，右营养统计 + 编辑
加餐：左真实照片，右营养统计 + 编辑
底部：今日碳水 / 蛋白质 / 脂肪 / 总热量
```

编辑按钮进入「编辑一餐」子页面；新增和编辑复用同一数据/表单逻辑。

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

## 9. 体重、日历、小信箱与药箱

### 日历

- 主月历显示双方心情圆脸；
- 点击日期进入日历详情；
- 日历详情回顾心情、睡眠、活动、饮食概览；
- 不做成功率/连续打卡评价。

### 体重

- 顶部 `我 / Ta`；
- 当前体重；
- 周/月/年趋势；
- 折线图；
- 近期记录；
- 记录体重。

### 小信箱

- 收到的 / 我写的；
- 信纸卡片；
- 不用人物头像做列表主体；
- 不做写信次数和连续记录。

### 家庭药箱

作为独立数据域；收到真实 Excel 后再最终确定 schema 和导入字段。

目标包括：药名 / 规格 / 数量 / 存放位置、保质期 / 开封后有效期、状态与软删除、source / idempotency、AI 受限查询与确认后修改、change log / audit。

真实 Excel 和真实家庭库存数据不得提交到 GitHub migration。

## 10. 游戏机扩展接口

游戏机不是旧游戏详情页，而是**游戏目录**。

本轮：

```text
宝石金币游戏
更多游戏（敬请期待）
```

后续游戏入口建议统一拥有：

```text
gameKey
title
cover
status
route
```

当前「宝石金币游戏」route 指向现有 Legacy Game；不在 V2 本轮重写其详情页。

未来小游戏可以新增，但不得自动把生活记录主数据变成全局排行榜。

## 11. 后续顺序

```text
V2-P0  新旧边界 + /game + 解耦                    ✅
↓
V2-P1  心情 / 睡眠 / 活动 schema + API             ✅
↓
V2-UI0 统一视觉语言设计 + 人工确认                   ✅
↓
V2-UI1 视觉 token / App* / Pattern 基础实现          ← 当前下一步
↓
V2-P2  新生活 App Shell + 今日首页
↓
V2-P3  独立饮食页 + 编辑一餐 + kcal optional
↓
V2-P4  月度日历 + 日历详情
↓
V2-P5  小窝 + 体重页
↓
V2-P6  家庭药箱 + 添加/编辑药品
↓
V2-P7  小信箱
↓
V2-P8  游戏机列表 -> Legacy Game 入口
↓
Later   更多小游戏 / 双方正式动森角色替换 / 岛屿生活可视化
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

当前下一步不是继续改视觉方向，而是**按已确认视觉语言做实现基础**：

```text
V2-UI1
├─ 把定稿色板/圆角/阴影落成全局 token
├─ 审查/补齐 App* wrapper
├─ 建立 AppRoleSwitch（我 / Ta）
├─ 建立主 Page/Section/Record/FeatureTile Pattern
├─ 将 /ui-lab 调整为与定稿视觉一致的回归页
└─ Test / Lint / Build + Vercel Preview
```

完成后再开始正式 V2-P2 首页接 Life API。
