# 当前状态与 Roadmap

**状态日期：2026-09-02**

这份文件是“现在做到哪一步、下一步做什么”的唯一主状态页。

## 1. 当前生产状态

`main` 已完成 V2-P0 和 V2-P1，但生产根 `/` 仍显示成熟的双人健康游戏；旧游戏没有被删除。

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

## 2. 视觉规范源

统一视觉语言已经定稿：

```text
docs/12-island-life-design-system.md
```

这是 V2 后续可见 UI 的唯一主视觉规范。核心方向：暖白/奶油底、薄荷/青绿主识别、柔黄/珊瑚/浅蓝点缀；不再使用大面积棕色；低密度页面主题感更强，高密度数据页面保持克制。

## 3. V2 信息架构（定稿）

```text
今日 / 饮食 / 日历 / 小窝 / 我的
```

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
└─ 账号 / 设置 / 数据等后续入口
```

游戏机本轮只开发游戏列表，不开发新的游戏详情 UI。

## 4. V2-UI1 当前实施结果

开发分支：

```text
v2/ui-foundation
```

已经落地：

- [x] `app/island-life-tokens.css`：V2 独立视觉 token，不覆盖 Legacy Game 旧色板；
- [x] 暖白 / 薄荷 / 青绿 / 柔黄 / 珊瑚 / 浅蓝语义色；
- [x] 统一正文、边框、圆角、阴影、间距、动效 token；
- [x] `AppPageShell`；
- [x] `AppRoleSwitch`，固定默认文案 `我 / Ta`；
- [x] `AppRecordRow`；
- [x] `AppFeatureTile`；
- [x] `AppNutritionBar`；
- [x] `/ui-lab` 重建为定稿视觉语言组件展厅；
- [x] 心情、睡眠、活动 Pattern 与首页三入口规则对齐；
- [x] 饮食营养统计条 Pattern；
- [x] 小窝四入口 Pattern；
- [ ] GitHub Test / Lint / Build 最终验证；
- [ ] Vercel Preview 视觉检查。

`/ui-lab` 仍只使用假数据，不读写 Life API / Supabase，也不触发 Legacy Game settlement。

## 5. 数据边界

```text
intake    -> meals / meal_items
deficit   -> daily_record_sides.deficit_kcal
weight    -> weight_measurements
exercise  -> daily_record_sides.exercise_minutes（旧游戏）
```

V2 Life：

```text
mood_entries
sleep_records
activity_entries
record_write_receipts
```

生活系统中的“活动”是统一用户概念；手动 UI 不强迫填写分类，未来 AI 可以在明确事实基础上填 `activity_type / duration_minutes`。

## 6. AI 写入架构原则

统一遵循：

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
```

`lib/ai/record-write-protocol.ts` 已预留：

```text
meal / mood / sleep / activity / weight / medicine
```

AI 不获得任意 SQL 权限。

## 7. 旧游戏与饮食边界

旧游戏继续完整保留，代码仍主要位于：

```text
components/home
lib/home
HomeResourcesProvider
```

饮食已经完成代码级拆分：

```text
DailyMealsPanel            旧游戏适配层
└─ DailyMealsPanelCore     纯饮食 UI；不读取 HomeResourcesProvider
```

V2 独立饮食页应复用现有 Meal CRUD 与 `DailyMealsPanelCore`，而不是重建第二套数据逻辑。

## 8. 饮食定稿结构

```text
顶部：我 / Ta
早餐：左真实照片，右碳水 / 蛋白质 / 脂肪 / 总热量 + 编辑
午餐：同上
晚餐：同上
加餐：同上
底部：今日碳水 / 蛋白质 / 脂肪 / 总热量汇总
```

编辑按钮进入「编辑一餐」子页面；新增和编辑复用同一 Meal 表单/服务。

后续独立阶段把 kcal 改为 optional，保持：

```text
NULL = 没有估算
0    = 确实为 0 kcal
```

## 9. 日历 / 体重 / 小信箱 / 药箱 / 游戏机

### 日历
- 双人心情圆脸月历；
- 点击日期进入日历详情；
- 详情回顾心情、睡眠、活动、饮食概览；
- 不做成功率和连续打卡评价。

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
- 搜索 / 分类 / 库存 / 位置 / 保质期；
- 添加/编辑药品；
- 收到真实 Excel 后再最终定 schema；
- 真实库存数据不进入 GitHub migration。

### 游戏机
游戏机是游戏目录，不是旧游戏详情页。本轮只做：

```text
宝石金币游戏 -> /game
更多游戏 -> 敬请期待
```

未来游戏入口统一预留：

```text
gameKey
title
cover
status
route
```

## 10. UI 复用规则

新增可见 UI：

```text
已有 App*
↓
animal-island-ui 官方能力
↓
同风格且许可允许的成熟 GitHub Pattern
↓
成熟 headless / 通用库交互能力
↓
项目原创组件
```

外部项目视觉必须归一到 `docs/12-island-life-design-system.md` 和 `components/ui/App*`；不得把另一套色板/阴影/Button/Card 系统直接带入业务层。

## 11. 后续顺序

```text
V2-P0  新旧边界 + /game + 解耦                    ✅
↓
V2-P1  心情 / 睡眠 / 活动 schema + API             ✅
↓
V2-UI0 统一视觉语言设计 + 人工确认                  ✅
↓
V2-UI1 视觉 token / App* / Pattern 基础实现         🚧（代码已落地，待 CI/Preview）
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

## 12. 工程与安全

继续保持：

```text
Browser -> Next.js API -> server-only Supabase -> PostgreSQL
```

- Supabase secret 不进入浏览器；
- DDL 只通过新 migration；
- Web / ChatGPT / import 复用领域事实；
- 外部写入使用稳定幂等键；
- `/ui-lab` 不读写真实数据；
- UI1 不改 Legacy Game 规则，不改 Supabase schema。

## 13. 下一步

先完成 UI1 的 CI / Preview 验证。通过后进入：

```text
V2-P2
新生活 App Shell + 正式「今日」页面
```

正式首页只接现有 Life API 的心情 / 睡眠 / 活动，不把饮食、体重、药箱或小信箱塞回首页。
