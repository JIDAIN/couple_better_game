# UI 与 animal-island-ui 维护规范

## 1. 当前视觉定位

项目使用轻松的“动物岛 / 手账 / Nook 商店”视觉语言。

当前依赖：

```text
animal-island-ui ^1.0.1
```

`app/layout.tsx` 全局引入：

```text
animal-island-ui/style
```

UI 全量迁移已经完成；当前工作是**维护和扩展**，不是继续执行历史 migration phase。

## 2. UI 层级

### 官方库

提供基础视觉 primitive，如 Button / Card / Input / Modal / Icon / Title / Switch 等。

### `components/ui/App*`

项目 adapter/wrapper，统一业务页面的常用交互与视觉语义。

当前代表性组件：

```text
AppButton
AppButtonLink
AppCard
AppDialog / AppModal
AppInput
AppTextarea
AppSelect
AppIcon / AppGameIcon
AppProgressBar
AppCurrencyChip
AppRoleAvatar
AppScene*
AppBottomNavItem
AppHeatmapMarker
```

### 业务 UI

```text
components/home/*       游戏 UI
components/nutrition/*  饮食 UI
```

业务层优先组合 wrapper，不要在这里重新造一整套 primitive。

## 3. 使用优先级

新增可见 UI 时：

```text
已有 App* wrapper
-> 当前安装版本 animal-island-ui 官方组件
-> 确实无法承载时的项目 fallback
```

不要因为“裸 div/CSS 更快”就绕过已有 wrapper。

当前代码确实还有少量直接使用官方 `Title` / `Switch` 等组件，这是允许的：前提是没有合适 wrapper，并且使用的是当前安装版本真实 API。

## 4. 不臆造 API

实现前优先查看当前本地安装版本的：

```text
node_modules/animal-island-ui/AI_USAGE.md
node_modules/animal-island-ui/dist/types/index.d.ts
```

本地安装版本高于旧 Git 历史中的 UI 设计说明。

禁止：

- 猜不存在的 props；
- 把项目 wrapper variant 直接透传为官方 type；
- 依赖未经确认的 `--animal-*` CSS variable。

## 5. CSS 职责

项目 CSS 主要负责：

- 页面布局
- spacing / alignment
- safe-area
- responsive / mobile
- 业务专有可视化（如热力图）
- wrapper 必要 adapter

不应再创建第二套 Button/Card/Input/Modal 的完整视觉系统。

如果官方组件无法承载，需要 fallback：

1. 明确写出原因；
2. 视觉尽量从官方组件 / 官方设计值继承；
3. 封装成复用的 `App*`，不要散落在业务 JSX。

## 6. 场景映射

当前页面语义：

| 页面 | 场景 |
|---|---|
| 今日 | notice-board / 岛屿公告板 |
| 地图 | growth-map / 成长地图 |
| 商店 | shop / 小商店 |
| 小窝 | nook-phone |
| 成长日志 | notebook |
| 数据管理 | toolbox |
| 规则 | rules-board |

场景是视觉组织方式，不改变业务组件边界。

### 主导航稳定性

当前主导航固定为四个 Tab：

```text
今日 / 地图 / 兑换 / 小窝
```

一般业务扩展应先判断能否自然落入现有场景，不要为一个新模块立即增加新的底部 Tab。

只有明确的产品级信息架构改版，才重新评估主导航。

## 7. 当前饮食 UI 约定

P1 饮食 UI 已落在现有 `#today` notice-board，不新造“营养中心”页面：

```text
今日 notice-board
└─ AppSectionPanel「饮食小记」
   ├─ 日期
   ├─ fish / cat 角色切换
   ├─ 当天 kcal / 餐数
   ├─ AppCard 餐食记录
   └─ AppModal 新增 / 编辑 / 删除确认
```

实现使用：

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

### 饮食 UI 不允许做的事

- 为饮食单独创造一套与当前项目不同的色板、卡片、按钮、弹窗；
- 因为“营养功能很多”就擅自添加第五个底部 Tab；
- 用真实摄入的视觉文案暗示它会自动修改游戏 deficit；
- 把 ChatGPT 来源记录做成另一套 UI / 数据结构。

如果未来饮食功能明显超过今日公告板可承载范围，应先更新产品信息架构文档，再做页面迁移，而不是边开发边改导航。

## 8. 移动端优先

主要使用环境是手机浏览器，因此新增 UI 需要重点检查：

- 触控目标尺寸；
- safe-area；
- 底部导航不遮挡内容；
- Modal / sheet 在窄屏可滚动；
- 长中文不溢出；
- 数字列 tabular / 不抖动；
- loading / disabled / error 有可见状态。

饮食首版已经采用窄屏两列/按钮网格、可滚动 AppModal、tabular kcal 和 loading/empty/error 状态；后续修改不能破坏这些基础可用性。

## 9. 热力图日期视觉

成长地图：

- 按自然月浏览；
- 行为周六到周五；
- 首尾行显示完整自然周；
- 跨月日期仍读取真实 `recordDate`，但视觉弱化；
- 不显示左侧“第 N 周”标签；
- 改热力图布局不能顺手改变金币/宝石业务周规则。

## 10. 资源 UI

当前 currency semantics v2 下：

- coin = 每日打卡主要资源；
- gem = 周期规则奖励资源。

业务 UI 必须通过语义明确的 label / icon 展示。由于底层仍有 legacy 字段名，页面不要直接用变量英文名当中文文案。

饮食 kcal 不是 coin/gem，也不能复用资源奖励语义做展示。

## 11. 视觉变更验证

代码层最低要求：

```text
npm run test
npm run lint
npm run build
```

但这三项只能说明代码层通过，**不能代替真实视觉检查**。

涉及布局、Modal、移动端可用性的改动，在条件允许时还应人工检查：

- 常用手机窄屏；
- 长食物名 / 长备注；
- 多个 food items；
- loading / empty / error；
- 弹窗滚动与底部按钮；
- 底部导航遮挡。

未进行真实设备/浏览器视觉检查时，不要在文档或完成说明中写“视觉已验证”。

## 12. 维护原则

旧的：

```text
ui-migration-audit
ui-migration-report
ui-rollback-guide
ui-wrapper-migration-plan
animal-island-ui-full-migration Skill
```

都属于一次性迁移历史，不再作为当前维护流程。

大型视觉改版如果未来再次发生，应新开短期 issue/PR checklist；稳定结论最终回写本文件，而不是永久新增一套迁移文档。
