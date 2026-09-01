# Animal Island UI 页面设计规范 v2.3

> 本文档定义项目的**最终 UI 形态**，不是组件迁移步骤。
> 目标：一个统一的动物岛养成游戏界面，所有视觉由 animal-island-ui 官方组件提供，所有页面有明确的动森场景。

---

## 1. 最终 UI 定位

### 1.1 项目视觉身份

这是一个**动物岛养成游戏**的本地 Web 界面。玩家（一对情侣）每天记录运动和热量数据，赚取宝石和金币，兑换奖励。

项目的视觉语言来自 Nintendo 动物森友会系列的 Nook 生态：
- Nook Inc. 的暖色纸板美学
- 动物岛 UI 组件库（animal-island-ui）的官方视觉
- 岛屿生活的手账、公告板、小商店质感

### 1.2 核心原则：官方组件绝对优先

```
┌──────────────────────────────────────────────────────────┐
│ 所有可见交互控件和可见容器，必须优先使用                        │
│ animal-island-ui 官方组件或官方素材。                         │
│                                                          │
│ 只有不可见控制、浏览器原生能力、官方组件无法承载的复杂结构，        │
│ 才允许 fallback。fallback 必须登记原因，且视觉必须贴近官方组件，  │
│ 不得形成项目私有风格。                                       │
│                                                          │
│ Fallback 不是设计入口。它是证明官方组件无法承载后的最后手段。      │
│ 任何人在设计或实现时，默认路径必须是"用官方组件"，               │
│ 而不是"用 div + CSS，不行再换官方组件"。                       │
└──────────────────────────────────────────────────────────┘
```

**视觉溯源原则：**

任何视觉数值（颜色、字号、间距、圆角、阴影、边框），如果不是官方组件直接渲染出来的，**必须有来源记录**（DevTools computed CSS 截图/记录、官方文档设计值、或官方 demo 页面 URL）。没有来源记录的视觉数值视为自我设计，禁止合入。

**四不原则：**

| 原则 | 说明 |
|---|---|
| **不重复造轮子** | 官方有 Button → 不用裸 `<button>`。官方有 Card → 不用裸 `<div>` 自绘。官方有 Modal → 不用裸 `<div>` 自绘弹窗。官方有 Input → 不用裸 `<input>` 自绘。 |
| **不留私有视觉** | fallback 控件的颜色、圆角、阴影、边框必须从官方组件实际渲染结果或官方文档设计值中提取，不得自成一套项目私有风格。热力图色板也不例外——色值必须从官方文档设计值 / 官方组件 computed style 提取。 |
| **不默认 fallback** | 文档中不预设"这里用 CSS fallback"。先确认官方组件是否可承载，确认不可承载后才登记 fallback。 |
| **不留无源数值** | 任何视觉数值（颜色/字号/间距/圆角/阴影/边框）如果不是官方组件直接渲染的，必须有来源记录（DevTools computed CSS 记录、官方文档设计值、或官方 demo URL）。无来源记录 = 自我设计 = 违规。 |
| **不散落自绘** | 业务专有可视化（热力图、Chip、进度条、同步状态）必须封装为 `App*` wrapper 组件（`AppHeatmap`/`AppChip`/`AppProgress`/`AppSyncStatus`/`AppHeatmapLegend`），视觉从官方文档设计值 / 官方组件 computed style 提取。不得在业务页面 JSX 中散落自绘样式。 |

### 1.3 项目 CSS 的三个角色

```
官方组件 CSS Modules    →  按钮/卡片/输入框/Modal/Select/Tabs 的视觉（100% 由库提供）
项目 :root token         →  页面级色彩（背景、文字、chip、装饰、热力图色板——从 官方文档设计值 / 官方组件 computed style 提取）
项目 app-* class         →  布局适配（间距、对齐、flex/grid、max-width、safe-area），不画视觉
```

**项目 CSS 永远不重新画官方组件已经提供的颜色、边框、圆角、阴影、hover/active 状态。** 也不得自创第二套输入框/卡片/弹窗视觉。

### 1.4 项目 Token 规范

**重要前提：** animal-island-ui 官方 `AI_USAGE.md` 明确说明 `--animal-*` 设计 token 不会全局暴露，不是 CSS custom properties。项目**不得**依赖不存在的 `var(--animal-*)`，**不得**在 `:root` 中写 `var(--animal-bg-color)` 等引用。

#### 项目 token 的合法来源（五选一）

所有项目 token 的视觉值**必须**从以下来源之一提取，不得凭感觉自创：

| # | 来源 | 说明 |
|---|---|---|
| 1 | **本地 `node_modules/animal-island-ui/AI_USAGE.md`** | 官方使用说明，优先读取 |
| 2 | **本地 `node_modules/animal-island-ui/dist/types/index.d.ts`** | TypeScript 类型定义（组件导出名、props、type 值） |
| 3 | **GitHub 官方 `skill/SKILL.md`** | 官方 skill 定义 |
| 4 | **GitHub 官方 `DESIGN_PROMPT.md`** | 官方设计提示 |
| 5 | **官方 demo 或项目中官方组件的 DevTools computed style** | 实际渲染的 CSS 值（background、border、border-radius、box-shadow、color 等） |

来源 1-2 为本地安装版本，**优先级高于** GitHub 当前文档。每次执行前必须读取本地 `AI_USAGE.md` 和 `dist/types/index.d.ts`，不得臆造 API、props、type、token。

#### Token 定义格式

每个项目 token 必须硬编码从上述来源抄来的值，并记录来源：

```
Token              值           来源（必须填写）
--reward           #f5c31c      来源：官方 demo 金币 chip computed color
--reward-soft      #fff3c4      来源：官方 demo 金币 chip computed background
--growth-strong    #6fba2c      来源：官方 demo 成长 chip computed color
--text-body        #725d42      来源：AnimalCard content 文字 computed color
--text-muted       #9f927d      来源：AnimalCard 次要文字 computed color
--text-placeholder #c4b89e      来源：AnimalInput placeholder computed color
--card-border      #9f927d      来源：AnimalCard border computed color（限 fallback）
--card-border-soft #c4b89e      来源：AnimalCard 内部细分隔线 computed color（限 fallback）
--focus-yellow     #ffcc00      来源：AnimalInput focus ring computed color（限 fallback）
```

**允许硬编码视觉值，但只能硬编码从官方 `SKILL.md` / `DESIGN_PROMPT.md` / `AI_USAGE.md` / DevTools computed style 中抄来的值，并必须记录来源。** 不允许凭项目审美自我设计颜色、圆角、阴影、边框。没有来源记录的 token = 自我设计 = 违规。

#### 受限制 token——仅允许在已登记 fallback 中使用

以下 token **不得**用于覆盖官方组件（Button/Card/Input/Modal/Tabs）的视觉。仅当元素已登记为 §9.2 fallback 且不使用官方组件时，才允许引用：

```
--shadow-button    — 限 fallback 控件（来源：AnimalButton computed box-shadow）
--shadow-input     — 限 fallback 控件（来源：AnimalInput computed box-shadow）
--card-border      — 限 fallback 容器
--card-border-soft — 限 fallback 容器
--focus-yellow     — 限 fallback 控件（官方 Input 有自己的 focus ring）
```

**违规示例：** `.app-button--primary { box-shadow: 0 5px 0 0 var(--shadow-button); }` —— 这覆盖了 AnimalButton 的官方阴影，禁止。

**正确做法：** AnimalButton 的阴影由官方 CSS Modules 提供，项目不设置。`--shadow-button` 仅用于 AppBottomNavItem 等已登记 fallback。

### 1.6 文档约定：概念名 vs 实际 API

本文档中使用 **概念名** 指代官方组件，便于讨论。实现时**必须**使用 animal-island-ui 实际导出的组件名和实际 API。

| 文档概念名 | 实现时必须确认 | 说明 |
|---|---|---|
| `AnimalButton` | 实际导出名（如 `Button`）及其 props（`type`/`danger`/`disabled` 等） | 不得臆造不存在的 props |
| `AnimalCard` | 实际导出名（如 `Card`）及其 props（`type` 等） | 不得臆造不存在的 type 值 |
| `AnimalInput` | 实际导出名（如 `Input`）及其 props | 不得臆造不存在的变体 |
| `AnimalModal` | 实际导出名（如 `Modal`）及其 props | 不得臆造不存在的配置项 |
| `AnimalSelect` | 实际导出名（如 `Select`）及其 props | 不得臆造不存在的变体 |
| `Tabs` / `Checkbox` / `Switch` | Phase 0 审计确认实际导出名 | 先审计再使用 |

**实现前必须（按顺序）：**
1. **读取本地 `node_modules/animal-island-ui/AI_USAGE.md`** — 确认官方使用说明、token 说明、组件导出名
2. **读取本地 `node_modules/animal-island-ui/dist/types/index.d.ts`** — 确认合法的 props、type 值、组件签名
3. 阅读 GitHub 官方 `skill/SKILL.md` 和 `DESIGN_PROMPT.md` — 确认设计约束
4. 在本文档 §9.2 登记实际组件名与概念名的对应关系

**本地安装版本优先于 GitHub 当前文档。** 不得凭本文档臆造 API、props、type、token。

**禁止：**
- 凭本文档的概念名直接写 `import { AnimalButton } from "animal-island-ui"`（实际导出名可能不同）
- 在 wrapper 中使用官方组件不支持的 type/props 值
- 把项目 wrapper variant（如 `panel`/`item`/`compact`/`nav`）直接透传给官方组件

满足以下**全部条件**才允许 fallback：
1. animal-island-ui 确认无对应官方组件
2. 官方组件确实无法承载该交互/结构（不是因为"懒得改"）
3. fallback 视觉必须从官方组件实际渲染结果中提取视觉数值

**Fallback 视觉参数提取铁律：**

所有 fallback 控件的视觉参数（颜色、圆角、阴影、边框、间距）**必须从浏览器 DevTools 中检查官方组件实际渲染的 computed CSS 值后提取**。不得凭感觉写数值，不得以"项目 token 有自己的风格"为由保留与官方组件的视觉差异。

提取流程：
1. 浏览器打开 animal-island-ui 官方 demo 页面（或项目中已渲染的官方组件）
2. DevTools 检查目标官方组件（如 AnimalInput、AnimalCard、AnimalModal）的实际 computed CSS
3. 记录：background-color、border-color、border-width、border-radius、box-shadow（含 offset/blur/spread/color）、focus ring 参数
4. 将提取的数值写入项目 token 或 fallback class
5. 如项目 token 当前值与官方实际值不一致 → 修正项目 token

**禁止：** 不看 DevTools，凭"差不多""好看""之前就这么写的"来设定 fallback 视觉参数。

Fallback 必须在本 §9.2 登记。未登记的 fallback = 违规。

**禁止的 fallback 借口：**
- "官方组件样式不好看" → 不是理由
- "之前就是这么写的" → 不是理由
- "改起来太麻烦" → 不是理由
- "用 div + CSS 更快" → 不是理由

### 1.7 核心原则速查

实现者每次动手前必须过一遍：

1. **先查官方组件** — 任何可见控件/容器，先确认 animal-island-ui 是否有对应组件
2. **再查 wrapper** — 有官方组件 → 必须通过 `App*` wrapper 使用，不得裸调官方组件
3. **wrapper 不得透传私有 variant** — `panel`/`item`/`compact`/`nav` 是项目内部语义，必须映射为官方支持的 type/props
4. **fallback 是最后手段** — 必须逐项证明官方组件无法承载，并在 §9.2 登记
5. **视觉必须有源** — 任何视觉数值（颜色/字号/间距/圆角/阴影/边框）= 官方组件直接渲染，或 DevTools 提取 + 记录来源
6. **业务可视化用 wrapper** — Chip/Heatmap/Progress/SyncStatus 必须封装为 `App*` 组件，不散落自绘样式
7. **app-* class 只做布局** — 不设置 color/background/border/border-radius/box-shadow
8. **不额外叠加项目阴影** — 不覆盖官方阴影；降低压迫感通过选择更轻量的官方组件结构实现
9. **emoji 不是最终方案** — 装饰/图标必须替换为 AppGameIcon / AppRoleAvatar / AppCurrencyChip / AppHeatmapMarker / 官方稳定素材

违反以上任何一条 = 不合规，需返工。

### 1.8 执行规则：本地安装版本优先

**本地 `node_modules` 中的文件是真相源，优先于 GitHub 当前文档。**

每次执行前必须完成以下步骤，不得跳过：

1. **读取 `node_modules/animal-island-ui/AI_USAGE.md`** — 获取官方使用说明、组件导出名、token 说明
2. **读取 `node_modules/animal-island-ui/dist/types/index.d.ts`** — 获取合法的 props、type 值、组件签名
3. **核对组件导出名** — 本文档使用的概念名（`AnimalButton`/`AnimalCard` 等）必须与实际导出名对应
4. **核对 props/type** — wrapper 只能传递官方类型定义中存在的 props 和 type 值

**禁止：**
- 不读本地文件，凭本文档概念名直接 import
- 不读本地文件，凭记忆臆造 props 或 type 值
- 不读本地文件，假设 `--animal-*` CSS 变量可用
- 以 GitHub 文档版本比本地新为由跳过本地文件读取

**最终兜底原则：** 官方组件能覆盖的 UI → 必须用官方组件。官方不能覆盖的业务 UI → 必须 wrapper 化（`App*`）、在 §9.2 登记、视觉从官方文档设计值 / computed style 溯源。允许硬编码视觉值，但只能硬编码从官方 `SKILL.md` / `DESIGN_PROMPT.md` / `AI_USAGE.md` / computed style 中抄来的值，并必须记录来源。两者都不满足的自绘 UI → 违规，禁止合入。

---

## 2. 页面视觉场景

每个页面必须有一个明确的动森场景。场景决定页面的氛围、装饰、信息密度。

### 2.1 今日页 — 岛屿公告板 / 每日收获看板

**场景感：** 玩家每天早上在广场公告板前查看当天的任务和收获。公告板上钉着作战进度、双人成长面板、鼓励语。

**内容主卡片：** 一个有明显边界的公告板内容卡片（历史名 PageBoard），上面钉着：
- 标题（游戏名 + 日期）
- 作战进度条（第 X 天）
- 双人成长面板（两颗宝石余额 + 头像）
- 鼓励语便签

**公告板边界：** 公告板内容卡片必须有可见边界——优先使用 `<AppCard variant="panel">` → `AnimalCard` 提供视觉。它只负责内容卡片视觉，不负责整页定位。**不能是"无背景、内容自然流动"。**（`animal-stage--home` 是历史 fallback class，不得作为页面定位规则。）

**装饰：** 公告板边缘的图钉/小花/叶子。优先使用 animal-island-ui 官方素材（divider、icon）。emoji 仅作为文档语义占位（如 `[Icon: pin]`），不得作为实现 fallback 保留在最终视觉中。最多 2-3 个小装饰，分散在角落。

**不应该：**
- 不应该是一片绿色背景上漂浮独立白框
- 不应该有大面积 mint teal 色块
- 不应该有全屏径向渐变光晕抢内容焦点
- 不应该没有内容主卡片边界，内容直接散落在背景上

### 2.2 地图页 — 成长地图板

**场景感：** 墙上挂着的月度成长地图，用热力图标记每一天的运动情况。

**主看板：** 一张大地图板（`AppCard variant="hero"`），内含月份标题 + 翻页、作战开始日选择器、两张热力图、图例。

**装饰：** 地图板边缘的指南针/小旗标记。优先使用官方 icon 素材。

**不应该：**
- 地图板不要被过度装饰压住数据可读性

### 2.3 兑换商店 — Nook 小商店 / 货架

**场景感：** 岛上的 Nook 小商店，货架上摆着可以用宝石/金币兑换的奖励商品。

**内容主卡片：** 商店柜台内容卡片（历史名 PageBoard），内含商店标题 + 余额展示 + 宝石货架 + 金币货架 + 已兑换记录区。它不得控制页面顶部/底部位置。

**商品展示：** 货架上的小标签/价签，不是独立大卡片。每个商品是一行轻量条目。

**装饰：** 商店角落的小礼物盒图标。优先使用官方素材。

**不应该：**
- 每个商品不要做成独立大卡片（独立阴影 + 粗边框）
- 商品不要用 mint teal 或 reward yellow 做大面积背景
- 管理类别模式不要突然变成另一套视觉

### 2.4 小窝页 — NookPhone 设置页

**场景感：** 玩家的 NookPhone 界面。手机屏幕上的简洁功能列表，有圆角屏幕边框。

**主看板：** NookPhone 屏幕面板（PhonePanel）——一个有明显边界的手机屏幕容器（视觉由 `<AppCard variant="panel">` → `AnimalCard` 实际渲染提供），内含同步状态 + 最近记录 + 功能入口列表。

**子页面（规则/数据/日志）：** 统一的顶部导航栏（返回 + 标题），内容区在 PhonePanel 内。

**装饰：** 小房子图标。极少。

**不应该：**
- 功能入口不要做成 hero card
- 子页面不要各自发明不同的 header 风格
- **不要没有 PhonePanel 容器，内容直接散落在 parchment 背景上**

### 2.5 成长日志 — 手账本 / 便签册

**场景感：** 一本摊开的手账本。每月一页，每页有按日期排列的记录条目。

**主看板：** 手账本（SectionPanel），内含月份翻页 + 记录条目列表。

**记录条目：** 一行轻量条目——日期 + 宝石胶囊 + 金币胶囊 + "详情 ›" 链接。

**详情弹窗：** 翻开的手账页——日期 + 温柔副标题 + 两人数据 + 小奖励明细。

**装饰：** 手账边缘的叶子/书签。优先使用官方素材。

**不应该：**
- 记录条目不要做成带阴影的大卡片
- 详情页不要信息密集到喘不过气

### 2.6 数据管理 — 工具箱 / 存档柜

**场景感：** 岛上的工具柜，存放备份、导入导出功能。功能性强，装饰最少。

**主看板：** 一个工具面板，内含 GitHub 同步状态、密码设置、导入导出按钮。

**装饰：** 几乎无额外装饰。

**不应该：**
- 不要有花哨的卡片装饰
- Toast 不要用 rose 色系

### 2.7 规则说明 — 岛民公告栏

**场景感：** 广场上的岛民公告栏，整齐地贴着宝石规则、金币规则、恢复日规则、其他说明的纸条。

**内容主卡片：** 一张公告栏内容卡片（历史名 PageBoard，或 SectionPanel），顶部有公告栏标题（优先使用官方 Icon 组件；当前 [Icon: rules] 为临时标记）和一句温柔说明。公告栏内整齐排列多张规则纸条。

**规则纸条：** 每条规则是一张轻量纸条（ItemRow），包含规则标题（必须使用 AppGameIcon / 官方 Icon，不得使用 UI emoji）+ 规则内容。纸条之间用细分隔线或间距分开，不叠阴影。

**结构：**
```
内容主卡片（公告栏，历史名 PageBoard）
├── 公告栏标题 + 副标题（标题图标使用官方 Icon 组件，不得用 emoji）
├── ItemRow "鱼鱼宝石"（缺口宝石规则，图标使用官方 Icon）
├── ItemRow "猫猫宝石"（猫猫宝石规则，图标使用官方 Icon）
├── ItemRow "恢复日奖励"（图标使用官方 Icon）
├── ItemRow "一起加成"（图标使用官方 Icon）
├── ItemRow "金币规则"（图标使用官方 Icon）
└── ItemRow "其他说明"（图标使用官方 Icon）
```

**装饰：** 公告栏边缘的图钉 [Icon: pin]。极少。

**不应该：**
- 规则纸条不要做成带阴影的厚卡片
- 不需要 mint teal 或 reward yellow 大面积背景
- 不要保持当前"每张卡片独立浮在背景上"的样式

**改造优先级：** P1

---

## 3. 全局页面结构

### 3.1 唯一页面骨架：AppFrame

```
┌─ AppFrame (.app-frame)
│  ├─ SyncStatusBar (.app-sync-bar) — 固定顶部，同步状态指示
│  ├─ AppPageHeader (.app-page-header) — 固定页面标题栏
│  │   ├─ 左侧固定宽度区域：二级页返回；一级页占位
│  │   ├─ 中间标题：永远居中
│  │   └─ 右侧固定宽度区域：占位，保证标题真居中
│  ├─ AppPageScroll (.app-page-scroll) — 唯一页面滚动容器
│  │   └─ AppPageContent (.app-page-content) — 统一 max-width / padding / gap
│  │       └─ 页面主体内容（AppCard / SectionPanel / ItemRow 等内容组件）
│  └─ BottomTabBar (.app-bottom-bar) — 固定底部导航
```

这是项目**唯一**合法页面骨架。旧的 `.animal-page` / `.animal-stage` / PageBoard 控制页面位置 / `app-main-scroll` + `app-main-inner` 临时骨架均为历史实现，不得继续作为新实现依据。

### 3.2 AppFrame 布局职责

**AppFrame (`.app-frame`)**
- 职责：锁定应用视口，建立微信/小程序式固定骨架。
- 必须 `height: 100dvh`、`overflow: hidden`、`position: relative`。
- AppFrame 只负责页面骨架，不承载内容卡片视觉，不替代 AppCard。

**SyncStatusBar (`.app-sync-bar`)**
- 职责：固定顶部的同步状态指示器。
- 必须固定在最上方，高度稳定，z-index 高于页面内容、低于 Modal。
- 背景/分隔/透明度等视觉值必须有来源记录；无来源时只做布局容器。

**AppPageHeader (`.app-page-header`)**
- 职责：所有页面唯一标题栏。位于 SyncStatusBar 下方，固定高度。
- 一级 Tab 页面只显示居中标题，不显示返回按钮。
- 小窝二级页左侧显示轻量返回，标题仍然居中。
- 左/中/右三栏宽度规则必须保证标题真实居中；没有返回按钮时也保留左右占位。
- 返回按钮必须通过 `AppButton` / `AppHeaderBackButton` 等 wrapper 使用官方 Button 语义。
- 返回按钮不能是裸文本，不能是原生裸 `<button>`，也不能显示为大胶囊按钮。

**AppPageScroll (`.app-page-scroll`)**
- 职责：唯一页面滚动容器。
- 必须固定在 `SyncStatusBar + AppPageHeader` 下方、`BottomTabBar` 上方。
- 必须 `overflow-y: auto`、`overflow-x: hidden`，页面滚动不得落到 `window/body`。
- `activeTab` 或 `nestView` 变化时，必须滚动回顶部。

**AppPageContent (`.app-page-content`)**
- 职责：所有页面统一内容宽度、顶部间距、底部 breathing space、纵向 gap。
- 必须使用统一 `max-width`、`margin: 0 auto`、`padding`、`display: flex`、`gap`。
- 所有页面主体内容从 AppPageContent 的统一 padding-top 后开始。
- 所有页面尾部只保留 AppPageContent 的统一 padding-bottom，不允许页面自行添加大底部空白。

**BottomTabBar (`.app-bottom-bar`)**
- 职责：固定底部导航，独立于内容滚动区。
- 必须固定在屏幕底部，高度稳定，包含 safe-area-inset-bottom。
- 必须有不透明背景和顶部细分隔线；视觉值必须来自官方素材/组件 computed style 或已登记 token。
- 每个导航项内部使用 `AppBottomNavItem`，由 `AnimalButton` / 官方 Button 视觉承载。
- 不使用 `.app-button--nav` variant（`app-button--nav` 仅保留给小窝页的功能入口按钮）。

### 3.3 废弃规则：页面定位不得由内容卡片承担

以下规则已废弃，后续 Codex 不得继续使用：

- `.animal-page` 作为页面 shell。
- `.animal-stage` 作为页面舞台或页面定位容器。
- PageBoard / PhonePanel / AppCard 控制整页顶部位置、底部位置、滚动容器高度。
- `app-main-inner` / `app-main-scroll` 旧说明作为最终骨架规范。
- 页面组件自行写大 `margin-top` / `padding-top` / `padding-bottom` / `min-height` / `70dvh` / `100dvh` 来凑位置。
- 商店、日志、规则、数据管理等页面自行添加 TabBar 避让 padding。
- emoji 伪元素或散落 emoji 作为页面 chrome、标题图标或导航装饰。

**SectionPanel (必须 `<AppCard variant="panel">`)**
- 职责：将同类内容聚合为一个视觉分区
- **必须使用 `AppCard` → `AnimalCard` 渲染。** `.animal-panel-group` 是遗留 fallback class，未逐项证明 AppCard 无法承载前不得使用。
- 内部的子卡片/行不额外叠加项目阴影、不覆盖官方阴影；通过选择更轻量的官方组件结构降低压迫感

**ItemRow (必须 `<AppCard variant="item">`)**
- 职责：列表中单条轻量条目
- **必须使用 `AppCard` → `AnimalCard` 渲染。** `.animal-item-row` 是遗留 fallback class，未逐项证明 AppCard 无法承载前不得使用。
- 内部布局用 Tailwind 原子类

### 3.4 "白框问题"规则

**问题定义：** parchment 背景上直接漂浮大量独立白框，每个框有粗边框和独立阴影，视觉上互相孤立。

**禁止模式：**
```
❌ parchment 背景
  ❌ 白框（卡片）  ← 独立阴影 + 粗边框
  ❌ 白框（卡片）  ← 独立阴影 + 粗边框
  ❌ 白框（卡片）  ← 独立阴影 + 粗边框
  ❌ 白框（卡片）  ← 独立阴影 + 粗边框
```

**正确模式：**
```
✅ parchment 背景
  ✅ 内容主卡片（历史名 PageBoard，有可见边界，不控制页面位置）
    ✅ SectionPanel      ← 轻量分区，细边框
      ✅ ItemRow         ← 轻量条目，几乎无阴影
      ✅ ItemRow
    ✅ SectionPanel
      ✅ ItemRow
```

**具体规则：**
1. 每个页面可以有一个主内容卡片（历史名 PageBoard），但它只是 AppPageContent 内的内容卡片，不负责页面定位。
2. 主内容卡片如存在，必须有可见边界（视觉由 AppCard/AnimalCard 实际渲染提供），不能透明无背景。
3. 信息密集页面（商店、日志）必须将条目放入 SectionPanel 内，条目不额外叠加项目阴影、不覆盖官方阴影；通过选择更轻量的官方组件结构降低压迫感
4. 不要盒子套盒子：SectionPanel 内不要再嵌套 SectionPanel
5. 不要大面积 tinted 背景（`ui-tinted-primary` 等）把每个条目染成不同颜色
6. 如果某个区域只有 1-2 个条目，不必强行包 SectionPanel，直接用 ItemRow

---

## 4. 按钮规范

### 4.1 语义映射

所有按钮通过 `AppButton` → `AnimalButton` 使用。官方组件提供 100% 的视觉：按钮的颜色、边框、圆角、阴影、hover/active 状态由官方 CSS Modules 定义，项目不规定具体值。

**`variant` 是项目 wrapper 内部语义，不是官方 AnimalButton 的 prop。** `AppButton` 的 `variant` prop（`primary`/`danger`/`secondary`/`ghost`/`nav`）仅用于 wrapper 内部选择对应的官方 `type`（`primary`/`default`/`text`）。wrapper **不得**将 `variant` 值直接透传给官方组件。实现时必须在 `AppButton` 内部做 `variant → type` 映射，只传递官方支持的 props。

| 使用场景 | variant（wrapper 内部） | 官方 type（实际传递） | 视觉来源 |
|---|---|---|---|
| 主要操作（保存、确认、记录） | `primary` | `primary` | 官方 `AnimalButton type="primary"` 实际渲染效果 |
| 危险操作（删除确认） | `danger` | `primary` danger | 官方 `AnimalButton type="primary" danger` 实际渲染效果 |
| 次要操作（取消、返回） | `secondary` | `default` | 官方 `AnimalButton type="default"` 实际渲染效果 |
| 弱操作（翻页 ‹ ›） | `ghost` | `text` | 官方 `AnimalButton type="text"` 实际渲染效果 |
| 功能入口按钮（小窝页导航入口） | `nav` | `default` | 官方 `AnimalButton type="default"` + 项目布局适配 |
| Tab 切换（宝石/金币） | — | `default`（优先使用官方 Tabs 组件） | 官方 Tabs 组件；如不可用则 AnimalButton group fallback。`ui-tab-active` 不得设置 color/background/border/shadow，仅允许表达状态（如 `aria-selected`）或布局（如 flex） |

### 4.2 底部导航（BottomNav）——独立语义，独立组件

底部导航是**独立语义，不属于 AppButton variant 体系**。它不使用 `.app-button--nav`，也不应直接复用 `AppButton`。

**建议方案：** 抽成 `AppBottomNavItem` 组件，隔离于 `AppButton` / `app-button--nav`，避免底部导航视觉污染普通按钮 variant。

```tsx
// 推荐结构
<AppBottomNavItem active href="#today" icon="today" label="今日" />
<AppBottomNavItem href="#map" icon="map" label="地图" />
```

```css
/* 底部导航项：只做布局适配，视觉由内部 AnimalButton 提供 */
.app-bottom-nav-item {
  /* 仅布局：display, gap, padding */
  /* 视觉（border-radius, border, background, box-shadow, active 态颜色、pressed 位移）
     全部由内部 AnimalButton 的官方 CSS Modules 提供，项目不覆盖 */
}
.app-bottom-nav-item:active {
  /* pressed 态视觉（含 transform 位移）由内部 AnimalButton 官方状态提供；
     项目不得自定 translateY。如需位移，必须从 AnimalButton computed :active style 提取并登记来源 */
}
.app-bottom-nav-item--active {
  /* active 态视觉由内部 AnimalButton 的官方 active 状态提供 */
}
```

**`AppBottomNavItem` 必须在 Phase 1 启动抽取、Phase 2 前完成。** 不得长期保留 `AppButton` + `.app-bottom-nav-item` 过渡方案。`AppBottomNavItem` 内部必须使用 `AnimalButton`，视觉全部来自官方组件。

**`.app-button--nav` 的职责缩小为：** 仅小窝页的功能入口按钮（"成长日志"/"数据管理"/"规则说明"）。它是一个正常的 AppButton variant，用于全宽列表入口按钮的布局适配。

### 4.3 app-* button class 只做布局

```css
/* ✅ 允许：布局适配 */
.app-button--nav {
  min-height: 3.1rem;
  padding: 0.75rem 0.55rem;
  gap: 0.375rem;
  line-height: 1.15;
  text-align: center;
}

/* ❌ 禁止：视觉覆盖 */
/* font-weight, color, background, border, border-radius, box-shadow, hover/active 颜色 */
/* 按钮文字视觉（含 font-weight）由 AnimalButton 官方样式提供 */
```

### 4.4 唯一的按钮例外

**仅以下不可见控制允许不使用 AppButton：**

| 例外 | 使用方式 | 登记原因 |
|---|---|---|
| **遮罩层 (`AppDialogBackdrop`)** | 原生 `<button>` | 不可见遮罩，点击关闭弹窗。不是视觉按钮，不应有 AnimalButton 样式。背景色/透明度/blur 必须从 AnimalModal 实际 backdrop computed CSS 提取，不硬编码 |

**已消除的旧例外（不再有效）：**

| 旧例外 | 新方案 |
|---|---|
| ~~`.app-back-button` / 原生裸返回按钮~~ | 改为 `AppButton variant="ghost"` 或 `AppHeaderBackButton` → `AnimalButton type="text"`。返回按钮不得是裸文本、不得是裸 `<button>`、不得显示为大胶囊；项目 class 仅做 PageHeader 内的对齐和尺寸限制 |
| ~~`.growth-log-delete-btn`~~ | 改为 `AppButton variant="ghost"` → `AnimalButton type="text"`。弱删除是"文字按钮"，不需要自定义虚线边框。如确需虚线，用 `app-button--danger-text` class 做最小布局适配 |

**规则：任何可见的按钮交互，必须有 AnimalButton 视觉。** 不接受"这个按钮太特殊，自己画一个"。

### 4.5 链接按钮（AppButtonLink）

下载链接和外部链接**必须使用 `AppButtonLink`**。不得裸 `<a>` + 手写 class，不得用 Next.js `<Link>` 包装 blob/download。

`AppButtonLink` 规范：
- **优先方案：** 审计 animal-island-ui `Button` 是否支持 `as="a"` / `href` / `link` 等原生链接能力。如官方支持 → 直接使用 `AnimalButton as="a"`，无需 AppButtonLink。
- **fallback 方案（仅当官方不支持时）：** 渲染真实的 `<a>` 元素（语义正确）
- 透传 `download`、`target`、`rel`、`href` 等原生属性
- **视觉必须通过 DevTools 提取 AnimalButton computed CSS 后对齐**，不得凭项目 token 自绘。**禁止在 `<a>` 内部嵌套 `<button>`（HTML 规范禁止交互元素嵌套）**
- `app-button-link` class 只做 `<a>` 的布局适配（display、gap），不做任何视觉
- **禁止**用于 SPA 内页导航（内页用 Next.js `<Link>` + `AppButton`）
- **禁止**用 Next.js `<Link>` 包装 blob URL 或 `data:` URL

---

## 5. 卡片 / 看板规范

### 5.1 语义映射

**`variant` 是项目 wrapper 内部语义，不是官方 AnimalCard 的 prop。** `AppCard` 的 `variant` prop（`hero`/`default`/`soft`/`panel`/`item`/`compact`）仅用于 wrapper 内部选择对应的官方 `type`（`title`/`default`）和项目布局 class。wrapper **不得**将 `variant` 值直接透传给官方组件。`panel`/`item`/`compact`/`nav` 均**不是**官方 AnimalCard 支持的 type 值。

| 使用场景 | variant（wrapper 内部） | 官方 type（实际传递） | 视觉来源 |
|---|---|---|---|
| 热力图大外框 | `hero` | `title` | 官方 `AnimalCard type="title"` 实际渲染效果 |
| 独立内容卡片 | `default` / `soft` | `default` | 官方 `AnimalCard type="default"` 实际渲染效果 |
| 内容主卡片（历史名 PageBoard）/ SectionPanel | `panel` | `default` | 同上，项目 layout class 仅控制内容内部 padding，不控制整页位置 |
| SectionPanel 内条目 | `item` | `default` | 同上，padding 更紧凑 |
| 紧凑行内卡片 | `compact` | `default` | 同上，padding 最小 |

**项目不规定官方 Card 的具体颜色值、圆角值、阴影值。** 这些由官方 `AnimalCard` CSS Modules 决定。

### 5.2 app-card--* class 只做布局

`app-card--*` 是官方 `AnimalCard` 已渲染视觉之上的**薄布局层**，不是第二套卡片视觉。

```css
/* ✅ 允许：布局、padding、position、overflow */
.app-card--hero     { position: relative; overflow: hidden; }
/* ❌ .app-card--hero::before 虚线装饰：装饰必须来自官方素材（Divider 组件或稳定图片），不得自绘 */
.app-card--main     { padding: var(--space-card); }
.app-card--item     { padding: 0.75rem; }
.app-card--compact  { padding: 0.625rem 0.75rem; }

/* ❌ 禁止：border-radius, background, border, box-shadow, 或任何覆盖官方 Card 视觉的属性 */
```

**规则：** `app-card--*` 不再允许设置 `border-radius`、`background`、`border`、`box-shadow`。这些全部由官方 `AnimalCard` CSS Modules 提供。项目的 `--radius-*` token 不应用于 `app-card--*`。

**唯一例外——SectionPanel / ItemRow fallback：** 当元素**不使用 `<AppCard>` 组件**（语义标签如 `<section>`、`<li>`，或 section-panel/item-row 等非卡片概念）时，允许通过项目专用 class（`.animal-panel-group`、`.animal-item-row`）设置必要的视觉属性。这些 class 不是 `app-card--*` 系列，不受上述限制，但必须使用项目 token 变量。

### 5.3 内容卡片 / PhonePanel / SectionPanel / ItemRow —— 优先使用 AppCard

所有可见容器必须优先使用 `AppCard` → `AnimalCard`。

| 容器角色 | 优先方案 | fallback（仅在 AppCard 无法承载时） |
|---|---|---|
| **内容主卡片**（历史名 PageBoard） | `<AppCard variant="panel">` → `AnimalCard` | `.animal-panel-group`（登记） |
| **PhonePanel**（小窝页屏幕） | `<AppCard variant="panel">` → `AnimalCard` | `.animal-phone-panel`（登记） |
| **SectionPanel**（内容分区） | `<AppCard variant="panel">` → `AnimalCard` | `.animal-panel-group`（登记） |
| **ItemRow**（轻量条目） | `<AppCard variant="item">` → `AnimalCard` | `.animal-item-row`（登记） |

**核心规则：默认用 AppCard，不要默认用 CSS 自绘方框。**

**fallback 触发条件（全部满足）：**
1. 语义标签必须保留（`<section>`、`<article>`、`<li>`），AppCard 渲染的是 `<div>`
2. 或 AnimalCard 的 padding/内部结构与该容器的内容布局冲突
3. 在 §9.2 已登记

**区分：**
```
<AppCard variant="panel">              ← 优先：官方 Card 视觉
<AppCard variant="item">               ← 优先：官方 Card 视觉
<section class="animal-panel-group">   ← fallback（登记后使用）
<li class="animal-item-row">           ← fallback（登记后使用）
```

**AppCard 边界：**

- AppCard / 历史 PageBoard / PhonePanel / SectionPanel / ItemRow 只负责内容卡片视觉和内容内部布局。
- AppCard 不得控制整页顶部位置、底部位置、滚动容器高度、TabBar 避让、页面 header 位置。
- 禁止通过 AppCard 的 `margin-top`、`padding-bottom`、`min-height`、`70dvh`、`100dvh` 来修页面骨架。
- 页面骨架只能由 AppFrame / SyncStatusBar / AppPageHeader / AppPageScroll / AppPageContent / BottomTabBar 负责。

---

## 6. 输入框规范

### 6.1 官方 Input

`AppInput` → `AnimalInput`。官方提供全部视觉。项目不规定官方 Input 的具体颜色、边框、阴影、圆角值——这些由官方 CSS Modules 决定。

项目只通过 `::placeholder { color: var(--text-placeholder) }` 设置占位文字颜色。

### 6.2 已登记的特殊 input 例外

以下 input 类型需特殊处理：

| 类型 | 使用方式 | 原因 |
|---|---|---|
| **`type="file"`** | 原生 `<input type="file">` | 浏览器文件选择器，无法用 AnimalInput 包装。隐藏放置，通过按钮触发 `click()` |
| **`type="checkbox"`** | 先审计 animal-island-ui 是否有 `Checkbox`/`Switch` 官方组件 | 如有官方组件，必须使用；如确认无，才用原生 `<input type="checkbox">` + `accent-[var(--primary)]` |
| **`type="date"`** | `AppInput type="date"` | 官方 Input 支持透传，日期选择器 UI 由浏览器/OS 提供，AnimalInput 提供外壳视觉 |
| **`type="datetime-local"`** | `AppInput type="datetime-local"` | 同上 |

**checkbox/switch 审计（Phase 0 执行）：**
1. 检查 animal-island-ui 是否导出 `Checkbox` 或 `Switch` 组件
2. 有 → 项目所有 checkbox/switch 必须改用官方组件
3. 无 → 原生 `<input type="checkbox">` 维持，但必须在此登记

### 6.3 Fallback 输入组件

每个 fallback 必须从 `AnimalInput` 实际渲染结果中提取视觉参数（背景色、边框色、边框宽度、圆角值、阴影色/偏移量、focus 态颜色/宽度），不得自造数值。

| Fallback | 原因 | 视觉规则 |
|---|---|---|
| `AppTextarea` | 官方无 textarea | **必须对齐 AnimalInput 实际视觉**（复制其 background、border、border-radius、box-shadow、focus ring 参数）。项目 token 变量值需与官方 AnimalInput CSS 实际值一致 |
| `.app-compact-control` | 官方 Input 无 compact 变体，且是 label+input+unit 复合结构 | **必须对齐 AnimalInput 实际视觉**（同上） |
| `.app-input-shell` | 复合容器（按钮+文字+按钮），不是单个输入框 | **必须对齐 AnimalInput 实际视觉**（同上） |

**对齐审计（Phase 0 执行）：**
1. 浏览器 DevTools 检查 `AnimalInput` 实际渲染的 CSS 值
2. 对比项目 token（`--control-bg`, `--control-border`, `--shadow-input`, `--focus-yellow`）与官方实际值是否一致
3. 不一致 → 修正项目 token 以匹配官方
4. 不得以"项目 token 有自己的风格"为由保留差异

---

## 7. 弹窗统一规范

### 7.1 核心规则：优先 AppModal，默认居中

```
弹窗优先级：
1. AppModal → AnimalModal（默认：所有弹窗）
2. app-dialog-shell（⚠️ 待迁移遗留结构，不是合规结构）
3. app-dialog（⚠️ 待迁移遗留结构，不是合规结构）
```

**`app-dialog-shell` 和 `app-dialog` 是待迁移遗留结构，不是合规方案。** 每个实例必须先尝试 `AppModal` → `AnimalModal`；只有逐实例证明 `AnimalModal` 无法承载，才允许在 §9.2 登记 fallback。长期目标：消除所有 app-dialog-shell/app-dialog，全部迁移到 AppModal。

**所有业务弹窗默认居中显示。** 不要默认用 `app-dialog-shell` 自绘弹窗——先确认 `AnimalModal` 是否可承载。

**每个 `app-dialog-shell` / `app-dialog` 实例必须在 §9.2 单独登记原因。** 不得使用"typewriter 不适用"作为批量豁免理由——必须说明该弹窗的**具体什么特征**导致 AnimalModal 无法承载（如：需要自定义过渡动画、内容高度超过 Modal 最大高度、需要多段式 sheet 交互等）。

### 7.2 弹窗分类与优先级

| 类型 | 合规方案 | 待迁移遗留结构（逐实例证明后方可使用） | 使用场景 |
|---|---|---|---|
| **居中确认弹窗** | `AppModal` → `AnimalModal` | `app-dialog`（待消除） | 删除确认、导入确认 |
| **居中表单弹窗** | `AppModal` → `AnimalModal` | `app-dialog-shell`（待消除） | 记录今日、成长日志列表/详情/编辑、兑换商店 |
| **Toast** | `AppToast` | — | 操作反馈通知 |

**`app-dialog-shell` / `app-dialog` 是待消除遗留结构。** 当前仅允许在逐实例证明 AnimalModal 无法承载后使用；Phase 4 目标是将它们全部迁移到 AppModal。

### 7.3 底部 Sheet —— 无默认例外，需用户确认

**所有业务弹窗默认统一居中。** 不预设任何底部 Sheet 例外。

底部 Sheet 仅在以下条件**全部满足**时才允许使用：

1. 弹窗内容为列表/表单，高度可能超过屏幕 60%
2. 移动端优先（`max-width < 640px` 时触发底部弹出）
3. **用户明确确认该弹窗需要底部 Sheet**（不得由开发者自行判断）
4. 在本文档 §9.2 中已明确登记该弹窗名称和原因

**当前无已登记的底部 Sheet 例外。** 之前的 RecordTodaySettlement 和 ExchangeShop sheet 模式例外已删除。如需底部 Sheet，必须逐实例向用户确认后在此登记：

| 弹窗 | 登记原因 | 用户确认日期 |
|---|---|---|
| （待用户确认后填写） | — | — |

**PC 端（`min-width: 640px`）：** 所有弹窗统一居中缩放。

### 7.4 统一规则

1. **同类弹窗宽度统一：**
   - 表单弹窗：`max-w-lg`（32rem）
   - 确认弹窗：`max-w-sm`（24rem）
   - 列表弹窗：`max-w-md`（28rem）
2. **标题区结构统一：** 标签行 + 标题 + 副标题。字号/字重/颜色遵循 AnimalModal 官方排版，项目不规定具体值（如 10px、text-lg、text-xs 等）
3. **按钮区结构统一：** footer 中次要按钮在左/主按钮在右，flex gap 一致。按钮视觉由 AnimalButton 提供，项目不规定按钮内字号/字重
4. **遮罩层统一：** 全部使用 `AppDialogBackdrop`（`<button>` 元素，已登记例外）。背景色、透明度、blur 值**必须从 AnimalModal 实际 backdrop computed CSS 提取并记录来源**，不得硬编码 `rgb(...)` 或 `blur(...)` 数值。当前 `rgb(114 93 66 / 0.28)` + `blur(3px)` 为临时值，Phase 0 审计后替换为 DevTools 提取值
5. **弹窗内三段式：**
   ```
   app-dialog-header   — 标题、副标题、日期
   app-dialog-body     — 可滚动内容
   app-dialog-footer   — 操作按钮
   ```
6. **弹窗打开时底部导航被遮罩覆盖**（弹窗 z-index 55-70 > 底部导航 z-index 30）

### 7.5 Toast 规则

- 固定底部居中，`pointer-events: none`
- `z-index: 60-80`（在弹窗遮罩之上）
- 统一使用 `AppToast` + `app-toast` class
- 禁止在 JSX 中使用行内 style 或 ad-hoc class 覆盖 Toast 视觉
- DataManagement 的 rose 色系 Toast 必须改为 `app-toast`

---

## 8. 动森素材与装饰规则

### 8.1 素材优先级

```
1. animal-island-ui 官方素材（divider SVG、icon SVG、footer SVG/webp）
2. 项目本地素材（content_bg_pc.jpg、home_bg.webp、menu_bg.svg）
3. emoji —— **仅限文档语义占位**（如 `[Icon: xxx]`），不得作为实现 fallback 保留在最终视觉中。素材暂缺时登记为未完成项
```

### 8.2 animal-island-ui 官方可用素材

**使用原则：**
1. 优先使用 animal-island-ui **公开导出的组件**（`Divider`、`Icon`、`Footer` 等），通过 JSX 引用，不碰内部 CSS Modules hash class
2. 如无公开组件，将**稳定命名的官方素材文件**复制到 `public/animal-island-ui/` 并登记路径
3. 禁止在项目代码中引用 `animal-island-ui/dist/` 内的 hash class（如 `.animal-divider-ZBhpE`）——hash 随版本变化

**已知可用的官方导出组件：**
| 组件 | 用途 |
|---|---|
| `Divider` | 分隔线（棕/薄荷绿/白/黄/波浪黄变体） |
| `Icon` | 图标（camera/miles/critterpedia/diy/design/map/chat/helicopter/shopping/variant/wifi/location/page） |
| `Footer` | 页脚（海洋 SVG / 树木 webp） |

**已复制到 public/ 的官方稳定素材：**
| 文件 | 路径 | 用途 |
|---|---|---|
| `content_bg_pc.jpg` | `/animal-island-ui/` | 全局 parchment 背景 |
| `home_bg.webp` | `/animal-island-ui/` | 弱纹理叠加 |
| `menu_bg.svg` | `/animal-island-ui/` | 当前未使用 |

**如需要更多素材（装饰用）：**
- 优先查找 animal-island-ui 官方 demo 中的稳定命名图片（如 `animal_icon.png`、`nook1.svg`、`property-shopping.svg` 等）
- 确认文件名为稳定名称（非 hash），复制到 `public/animal-island-ui/` 并在此登记
- emoji 仅作为文档语义占位（如 `[Icon: xxx]`），不得作为实现 fallback。素材暂缺时登记为未完成项

### 8.3 项目本地素材

| 素材 | 路径 | 用途 |
|---|---|---|
| `content_bg_pc.jpg` | `/animal-island-ui/` | **全局 body 背景**，parchment 纹理 |
| `home_bg.webp` | `/animal-island-ui/` | `body::before` 弱纹理层，opacity 0.03 |
| `menu_bg.svg` | `/animal-island-ui/` | 当前未使用，保留供未来菜单背景 |

### 8.4 装饰规则

**装饰原则：**
- 优先使用 animal-island-ui 官方素材（导出组件 + 稳定命名图片）
- 所有业务 UI 图标必须通过项目 wrapper 使用：`AppGameIcon` / `AppRoleAvatar` / `AppCurrencyChip` / `AppHeatmapMarker`。
- `components/home/**` 中不得散落 UI emoji 作为图标、标题前缀、按钮图标、页面 chrome 或伪元素装饰。
- **emoji 仅限文档语义占位。** 实现阶段不得保留 emoji 作为最终视觉——必须替换为官方 Icon 组件或稳定素材。素材暂缺时在本文档登记为未完成项，不得以"没找到素材"为由保留 emoji
- **这包括页面标题中的占位标记**（如 `[Icon: rules]`、`[Icon: fish]` 等）——实现时必须替换为官方 Icon 组件或稳定素材
- 装饰不参与布局（`position: absolute; pointer-events: none`）
- 装饰不遮挡任何交互元素
- 每页最多 1 个主装饰 + 1-2 个角落装饰
- 装饰通过 `.animal-deco-layer` 容器统一放置，`aria-hidden`

**分页装饰方案：**

| 页面 | 使用（官方稳定素材） | 备注 |
|---|---|---|
| 今日 | 棕色 `Divider` 组件作公告板顶部装饰；`nook1.svg` / `animal_icon.png` 作角落装饰 | 轻量，不压内容 |
| 地图 | `Icon` 组件（map）作地图板标记 | 内容卡片内部装饰，不做页面 chrome |
| 商店 | `Icon` 组件（shopping）；`property-shopping.svg` 作商店标记 | 内容卡片内部装饰，不做页面 chrome |
| 小窝 | `Icon` 组件（page）作设置标记 | PhonePanel 内，极少装饰 |
| 成长日志 | 棕色 `Divider` 组件或叶片图片装饰 | SectionPanel ::before |
| 数据管理 | `Icon` 组件（diy） | 几乎无装饰 |
| 规则说明 | 棕色 `Divider` 组件；`nook1.svg` 公告栏标记 | 极少装饰 |

**emoji 列已删除。** 实现时所有装饰必须使用官方素材，emoji 不是 fallback 选项。

**稳定素材获取流程：**
1. 在 animal-island-ui 官方 demo 或 `assets/` 中查找**稳定文件名**（非 hash 名）
2. 复制到 `public/animal-island-ui/` 目录
3. 在本文档登记文件名和用途
4. 项目中通过 `<img src="/animal-island-ui/xxx.svg" />` 引用，不碰 CSS Modules hash class

**禁止事项：**
- 不要满屏撒 emoji
- 不要用大面积 CSS 径向渐变模拟"光效"
- 不要用 `ui-ambient-*` 的大圆 blob 抢内容焦点（当前 HomeScreen 有 3 个 48-64 大小的模糊圆，应移除或最小化）
- 不要为了装饰制造顶部空白

### 8.5 背景层次

```
body
├── background: url(content_bg_pc.jpg) + 官方文档设计值或官方 demo/computed style 中的背景色值  ← 主背景（官方 parchment 素材 + 来源记录）
├── ::before: url(home_bg.webp) opacity 0.03                     ← 极弱纹理叠加
│
└── .app-frame
    ├── .app-sync-bar
    ├── .app-page-header
    ├── .app-page-scroll
    │   └── .app-page-content
    └── .app-bottom-bar
```

`.animal-page`、`.animal-stage`、`.animal-deco-layer`、`ui-ambient-*`、radial-gradient ambient glow 均为历史背景/装饰思路，不再作为页面 UI chrome 规范。页面 chrome 只由 AppFrame 负责；装饰只能作为 AppPageContent 内的非交互内容装饰，且必须使用官方稳定素材或图标 wrapper。

---

## 9. 官方组件优先规则

### 9.1 强制使用官方组件

| 元素 | 必须使用 | 禁止替代 |
|---|---|---|
| 按钮 | `AppButton` → `AnimalButton` | 裸 `<button>` + class（仅 AppDialogBackdrop 例外） |
| 输入框 | `AppInput` → `AnimalInput` | 裸 `<input>` + class（已登记例外除外） |
| 卡片/容器 | `AppCard` → `AnimalCard` | 裸 `<div>` + class（仅已登记 fallback 除外） |
| Select | `AppSelect` → `AnimalSelect` | 裸 `<select>` |
| 弹窗 | `AppModal` → `AnimalModal` | 裸 `<div>`（仅已登记 fallback 除外） |
| Tab 切换 | animal-island-ui `Tabs` 组件（优先） | AppButton group + `ui-tab-active` class（仅当 Tabs 无法承载时 fallback） |
| Checkbox/Switch | animal-island-ui `Checkbox`/`Switch` 组件（先审计，有则必须用） | 原生 `<input type="checkbox">`（仅当确认无官方组件时） |

**Tab 审计（Phase 0 执行）：**
1. 检查 animal-island-ui 是否导出 `Tabs` 组件
2. 检查 `Tabs` 是否支持项目需要的 tab 数量/样式
3. 可用 → 必须使用官方 `Tabs`
4. 不可用 → AppButton group fallback 登记，但在本 §9.2 必须有记录

**Tab fallback 规则：** 如确需使用 AppButton group 作为 tab 切换，`ui-tab-active` class **不得设置 color、background、border、border-radius、box-shadow**——这些由内部 AnimalButton 的官方状态提供。`ui-tab-active` 仅允许表达状态（如 `aria-selected="true"`）或纯布局属性。不得用 `ui-tab-active` 自创第二套 tab 视觉。

### 9.2 已登记例外（完整清单）

**只有以下情况允许不使用官方组件。未出现在此清单的 = 违规。**

#### 不可见控制例外

| 例外 | 登记原因 |
|---|---|
| `AppDialogBackdrop`（原生 `<button>`） | 不可见遮罩，不是视觉控件 |

#### 浏览器原生能力例外

| 例外 | 登记原因 |
|---|---|
| `<input type="file">` | 浏览器文件选择器，必须原生 |
| `<input type="checkbox">` | 仅当 animal-island-ui 确认无 Checkbox/Switch 组件时允许 |
| `<input type="date">` / `<input type="datetime-local">` | 日期选择器 UI 由 OS/浏览器提供，AnimalInput 提供外壳 |

#### 业务专有可视化例外

以下为**业务逻辑强相关的可视化元素**，官方无对应组件，允许存在。但**必须封装为项目 wrapper 组件**（`AppHeatmap` / `AppChip` / `AppProgress` / `AppSyncStatus`），不得在业务页面中散落自绘样式。视觉必须从官方文档设计值 / 官方组件 computed style 提取，不得自创色板。

| 例外 | 对应 wrapper | 登记原因 | 视觉约束 |
|---|---|---|---|
| **Heatmap（热力图）** | `AppHeatmap` | 官方无热力图组件；业务核心可视化 | 色板限定 parchment/yellow/green/mint/brown，禁止 pink/rose。具体色值从 官方文档设计值 / 官方组件 computed style 提取 |
| **Heatmap legend（热力图图例）** | `AppHeatmapLegend` | 官方无对应组件；热力图配套图例 | 与 Heatmap 同色板 |
| **Chip（胶囊标记：宝石/金币/成长）** | `AppChip` | 官方无 chip/徽章组件；业务状态标记 | 背景色/文字色从官方文档设计值 / 官方组件 computed style 提取 |
| **Progress bar（作战进度条）** | `AppProgress` | 官方无进度条组件；业务进度可视化 | 颜色从 官方文档设计值 / 官方组件 computed style 提取 |
| **Sync status（同步状态指示）** | `AppSyncStatus` | 官方无同步状态组件；系统状态指示 | 颜色从官方文档设计值 / 官方组件 computed style 提取 |

**违规：** 在业务页面 JSX 中直接写 `className="growth-gem-chip"` 或 `style={{ backgroundColor: ... }}` 然后渲染 Chip。
**合规：** `<AppChip type="gem" value={3} />`，视觉集中在 `AppChip` 组件内管理。

#### 弹窗 fallback 实例登记（app-dialog-shell / app-dialog）

`app-dialog-shell` 和 `app-dialog` 是待迁移遗留结构，不属于合规弹窗方案。每个使用实例必须在此单独登记，说明为何 `AnimalModal` 无法承载。

| 弹窗名称 | 使用组件 | 为何不能用 AnimalModal | 视觉约束 |
|---|---|---|---|
| （待 Phase 4 逐实例审计后填写） | — | — | 背景/边框/圆角/阴影从 AnimalModal 实际渲染结果提取 |

#### 非弹窗 fallback 组件登记

以下为官方无对应组件的结构 fallback，不属于弹窗体系。

| Fallback | 登记原因 | 视觉约束 |
|---|---|---|
| `app-compact-control` | 官方 Input 无 label+input+unit 复合紧凑尺寸 | 背景/边框/阴影/圆角从 AnimalInput 实际渲染结果提取 |
| `AppBottomNavItem` | 官方无 BottomNav 组件 | 内部优先使用 AnimalButton |
| `AppButtonLink` | 需真实 `<a>` 语义（download/external link），不能嵌套 `<button>` | 优先使用官方 Button 支持的 `as`/`href`/`link` 能力；如不支持则渲染真实 `<a>`，通过官方 Button computed style 对齐视觉，不依赖不存在的 CSS variables。禁止内部嵌套 `<button>` |
| `app-toast` | 官方无 Toast 组件 | 背景/边框/阴影/圆角从官方文档设计值 / 官方组件 computed style 提取 |
| `app-textarea` | 官方无 Textarea 组件 | 背景/边框/阴影/圆角从 AnimalInput 实际渲染结果提取 |
| `.animal-panel-group` | SectionPanel/内容主卡片语义容器，AppCard 渲染 `<div>` 与 `<section>` 语义冲突时 | 背景/边框/阴影/圆角从 AnimalCard 实际渲染结果提取 |
| `.animal-item-row` | ItemRow 语义行，同上 | 同上 |
| `.animal-phone-panel` | 小窝 PhonePanel，同上 | 同上 |
| `.animal-deco-layer` / `.animal-deco` | 纯装饰，无交互 | 优先使用官方稳定素材图片 |
| AppButton group Tab | 仅当 animal-island-ui Tabs 确认无法承载时 | 内部使用 AnimalButton |

#### 已消除的旧例外

| 旧例外 | 消除原因 | 新方案 |
|---|---|---|
| ~~`.app-back-button` 裸 button / 裸文本返回~~ | 可见返回必须有 AnimalButton 语义，且由 AppPageHeader 承载 | `AppButton variant="ghost"` 或 `AppHeaderBackButton` |
| ~~`.growth-log-delete-btn` 裸 button~~ | 同上 | `AppButton variant="ghost"` |
| ~~`<a download>` 裸链接~~ | 链接视觉必须复用 AnimalButton | `AppButtonLink` |
| ~~`<a target="_blank">` 裸链接~~ | 同上 | `AppButtonLink` |

### 9.3 app-* class 权限表

| Class | 允许 | 禁止 |
|---|---|---|
| `.app-button--*` | display, gap, padding, min-height, line-height, text-align（仅布局） | font-weight, color, background, border, border-radius, box-shadow, hover/active 颜色 |
| `.app-button-link` | display, gap, padding, min-height（仅布局） | font-weight, color, background, border, border-radius, box-shadow |
| `.app-bottom-nav-item` | 仅布局（display, gap, padding）；视觉由内部 AnimalButton 提供 | color, background, border, border-radius, box-shadow |
| `.app-card--*` | padding, position, overflow | border-radius, background, border, box-shadow，或任何覆盖官方 Card 视觉的属性 |
| `.animal-panel-group` | 仅复刻 AnimalCard 实际渲染值（SectionPanel fallback） | 自造数值、自创风格 |
| `.animal-item-row` | 仅复刻 AnimalCard 实际渲染值（ItemRow fallback） | 自造数值、自创风格 |
| `.app-input` | placeholder color | border, background, box-shadow, border-radius |
| `.app-input-shell` | 仅复刻 AnimalInput 实际渲染值（fallback）；border-radius 不是布局属性，必须从 AnimalInput computed style 提取并登记来源 | border, background, box-shadow；禁止把 border-radius 当布局属性 |
| `.app-textarea` | min-height, resize, width（仅布局）；border-radius 不是布局属性，必须从 AnimalInput computed style 提取 | 自造数值、自创风格；禁止把 border-radius 当布局属性 |
| `.app-dialog-shell` | 仅复刻 AnimalModal 实际渲染值（fallback） | 自造数值、自创风格 |
| `.app-dialog` | 仅复刻 AnimalModal 实际渲染值（fallback） | 自造数值、自创风格 |
| `.app-dialog-backdrop` | 仅复刻 AnimalModal 实际 backdrop 渲染值（fallback） | 自造数值 |
| `.app-compact-control` | 仅复刻 AnimalInput 实际渲染值（fallback） | 自造数值、自创风格 |
| `.app-toast` | 仅复刻 AnimalModal 实际渲染值 / 官方文档设计值（fallback） | 自造数值、自创风格（如 rose 色系） |
| `.app-page-header-back` / `AppHeaderBackButton` | PageHeader 内的固定宽度、对齐、轻量尺寸限制；视觉全部由 AnimalButton type="text" 提供 | 作为裸文本返回、裸 `<button>`、大胶囊按钮或自绘视觉 |
| `.growth-log-delete-btn` | margin, alignment, display, gap（纯布局）；视觉全部由 AnimalButton type="text" 提供 | padding, font-size, font-weight, border, background, color, box-shadow |

---

## 10. 每页改造方案

### 10.1 今日页

**当前问题：**
- `app-button--primary` 上挂了 `text-white`，覆盖了官方按钮的实际文字颜色
- 3 个大模糊圆（`ui-ambient-*`）抢内容焦点
- 内容主卡片无 AppCard 包装、无可见边界，内容直接散落在 parchment 背景上
- CoupleGrowthPanel / EncouragementQuote 内部使用 card class 无 AppCard 包装

**目标效果：**
一个有可见边界的岛屿公告板。视觉由 `<AppCard variant="panel">` → `AnimalCard` 实际渲染提供。

**改造优先级：** P0

**推荐结构：**
```
AppCard variant="panel"（公告板，有可见边界）
├── GameTitle
├── CampaignProgressBadge
├── CoupleGrowthPanel          ← 双人面板（轻卡片）
├── EncouragementQuote         ← 鼓励语（轻便签）
└── RecordTodayButton          ← "记录昨日"按钮（primary）
```

**改造要点：**
1. 移除所有 `text-white`
2. 内容主卡片添加可见边界：**使用 `<AppCard variant="panel">` → `AnimalCard` 提供视觉。** 它只负责内容卡片，不负责页面定位。如确需 fallback 到 CSS class，视觉参数必须从 `AnimalCard` 实际渲染结果中提取，不得自造数值。
3. 将 3 个 `ui-ambient-*` 大模糊圆移除或最小化
4. 装饰只保留 `.animal-deco-layer`，优先使用官方素材

**验收标准：**
- 公告板有可见边界（不是"内容直接浮在背景上"）
- 按钮显示为官方 AnimalButton primary 实际渲染效果
- 页面不是绿色背景 + 白框

---

### 10.2 地图页

**当前问题：**
- 基本正确，无重大问题
- `app-card--hero` 装饰需迁移到官方 Divider 组件或稳定素材

**目标效果：**
一张挂在墙上的月度成长地图板。

**改造优先级：** P2（微调）

**推荐结构：**
```
AppCard variant="panel"（地图板内容主卡片）
└── AppCard variant="hero"     ← 大地图板外框
    ├── 标题行（月份翻页）
    ├── 作战开始日选择器
    ├── PlayerHeatmap ×2
    └── HeatmapLegend
```

**改造要点：**
1. 热力图**业务逻辑**不动（`lib/home/` 不修改）。热力图**色板**可以且应当迁移到 官方文档设计值 / 官方组件 computed style。**允许的色板范围：parchment（米白/暖黄）、yellow（金黄）、green（绿色）、mint（薄荷绿）、brown（棕色）。禁止使用 pink（粉色）或 rose（玫瑰色）系任何颜色。** "颜色不要改"不是挡箭牌——业务逻辑保护 ≠ 视觉色板锁定
2. Hero card 装饰使用官方 `Divider` 组件或稳定素材图片，不自绘 `::before` 虚线
3. 装饰优先使用官方 icon-map 素材

**验收标准：**
- 地图板感（一张大板，不是多个独立卡片）
- 热力图色板已迁移到 官方文档设计值 / 官方组件 computed style

---

### 10.3 兑换商店

**当前问题：**
- 大量 `text-white` 覆盖
- 商品条目是独立大卡片（`app-card--soft app-card--compact` + `ui-tinted-*` 背景 + 独立阴影）
- 在 SectionPanel 内层次混乱
- 管理模式下卡片样式与浏览模式不一致

**目标效果：**
Nook 小商店的货架。两个 SectionPanel（宝石货架 / 金币货架），每个商品是轻量行条目。

**改造优先级：** P1

**推荐结构：**
```
AppCard variant="panel"（商店内容主卡片）
├── 商店 Header（标题 + 余额 badges）
│
├── SectionPanel "[Icon: gem] 宝石兑换"
│   ├── ItemRow（商品）          ← 轻量行，不是大卡片
│   └── ...
│
├── SectionPanel "[Icon: coin] 金币兑换"
│   └── ...
│
└── SectionPanel "已兑换记录"
    └── ...
```

**改造要点：**
1. 移除所有 `text-white`
2. 商品从独立大卡片改造为 SectionPanel 内的轻量行条目
3. 不额外叠加项目阴影、不覆盖官方阴影；通过选择更轻量的官方组件结构降低压迫感
4. `ui-tinted-*` 背景移除或改为极淡的左边框颜色标记
5. 管理模式的视觉与浏览模式统一

**验收标准：**
- 商店像货架，不是"一堆独立白框"
- 宝石区和金币区有明显的分区但不割裂
- 商品行轻量，不压迫

---

### 10.4 小窝

**当前问题：**
- 功能入口按钮使用 `app-button--nav`，视觉 OK。但需要与 BottomNav 的 `app-bottom-nav-item` 明确区分
- DataManagement inline 中有 `text-white` 覆盖
- 子页面各自有独立的 header 风格（NestSubPageHeader），应迁移到统一 AppPageHeader
- 最近记录的 `nest-record-row` 样式独立
- 缺少 PhonePanel 主容器，内容直接散落在背景上

**目标效果：**
NookPhone 设置页。首页有 PhonePanel 内容容器（视觉由 `<AppCard variant="panel">` → `AnimalCard` 实际渲染提供），内含同步状态 + 最近记录 + 功能入口列表。所有小窝二级页的返回+标题必须由 AppFrame 的 AppPageHeader 统一承载，不再放在 PhonePanel 内部。

**改造优先级：** P1

**推荐结构：**
```
PhonePanel（NookPhone 屏幕面板，有可见边界）
├── 同步状态卡片（轻量）
├── 最近记录（SectionPanel 内 ItemRow 列表）
└── 功能入口（app-button--nav ×3）    ← 使用 .app-button--nav variant

AppPageHeader（子页面: rules / data / log，左侧轻量返回 + 居中标题）
└── AppPageContent
    └── 子页面内容卡片
```

**改造要点：**
1. 新增/保留 PhonePanel 内容容器：**优先使用 `<AppCard variant="panel">` → `AnimalCard` 提供视觉。** 它不得控制页面头部位置、滚动高度或底部留白。如确需 fallback 到 `animal-phone-panel` class，视觉参数（background、border、border-radius）必须从 `AnimalCard` 实际渲染结果中提取。比公告板更轻但必须有可见边界。
2. 移除 DataManagement inline 中的 `text-white`
3. 最近记录行样式对齐 `record-item`
4. 明确区分：小窝入口按钮用 `.app-button--nav`，底部导航用 `.app-bottom-nav-item`（未来用 `AppBottomNavItem`）
5. 二级页返回迁移到 AppPageHeader，使用 `AppButton variant="ghost"` 或 `AppHeaderBackButton`（→ `AnimalButton type="text"`），不能裸文本、不能大胶囊

**验收标准：**
- 小窝有 PhonePanel 可见容器，内容不散落
- 功能入口按钮与底部导航视觉明确不同
- 子页面 header 风格由 AppPageHeader 统一

---

### 10.5 成长日志

**当前问题：**
- 记录条目 `growth-log-row` 阴影偏重
- `text-white` 覆盖
- 详情页信息密度较高（已在之前优化过一轮）

**目标效果：**
手账本。列表弹窗中的每月一页，记录条目为轻量行。详情弹窗为翻开的手账页。弹窗**居中显示**（不使用底部 Sheet）。

**改造优先级：** P1

**推荐结构：**
```
列表弹窗（居中）
└── SectionPanel (手账本)      ← animal-panel-group--log
    ├── 月份翻页
    └── ItemRow × N            ← growth-log-row（轻量行）
        └── 日期 + 宝石胶囊 + 金币胶囊 + "详情 ›"

详情弹窗（居中，优先 AppModal → AnimalModal）
└── AppModal
    ├── app-dialog-header（记录详情 / 修改这一天 + 日期 + 温柔副标题）
    ├── app-dialog-body
    │   ├── 宝石/金币胶囊
    │   ├── 鱼鱼/猫猫数据卡（growth-detail-extra-card）
    │   └── 小奖励区
    └── app-dialog-footer（关闭 + 编辑 / 删除 + 取消编辑 + 保存修改）
```

**改造要点：**
1. 移除 `text-white`
2. `growth-log-row` 不额外叠加项目阴影、不覆盖官方阴影；通过选择更轻量的官方组件结构降低压迫感，对齐 `record-item`
3. 弹窗全部居中，不改为底部 Sheet
4. 详情页保持之前的优化结果

**验收标准：**
- 日志列表像手账页，不是"一堆独立按钮卡片"
- 详情弹窗呼吸感好、居中显示
- 编辑页表单不拥挤

---

### 10.6 数据管理

**当前问题：**
- 大量 `text-white` 覆盖
- Toast 使用 rose 色系 ad-hoc 样式
- 导出文件后的链接使用 `<a>` + button class

**目标效果：**
工具箱。功能按钮排列清晰，无多余装饰。

**改造优先级：** P0

**改造要点：**
1. 移除所有 `text-white`
2. Toast 统一到 `app-toast`，移除 JSX 中的 rose 色系 class
3. 下载链接改用 `AppButtonLink`（渲染 `<a download>`，视觉复用 AnimalButton）
4. 文件选择器保持原生 `<input type="file">`（已登记例外）

**验收标准：**
- 按钮显示为官方视觉
- Toast 统一，无 rose 色系
- 下载链接使用 AppButtonLink，文件选择器使用原生元素

---

### 10.7 规则说明

**当前问题：**
- 当前方案写"无需改动"，但实际视觉是"多张独立厚卡片浮在背景上"——每张规则卡片使用 `app-card--panel app-card--item` class + 独立阴影和粗边框
- 缺少公告栏的整体感
- 现有的独立卡片堆叠违反"白框问题"规则

**目标效果：**
一张岛民公告栏。顶部有公告栏标题（"[Icon: rules] 规则说明"）和一句温柔说明。公告栏内整齐排列多张规则纸条，纸条之间用间距分隔，不叠阴影。

**改造优先级：** P1

**推荐结构：**
```
SectionPanel（公告栏）
├── 公告栏标题 + 副标题（标题图标使用官方 Icon 组件）
│   "规则说明" / "当前版本的宝石与金币规则"
├── ItemRow "鱼鱼宝石"（图标使用官方 Icon）
├── ItemRow "猫猫宝石"（图标使用官方 Icon）
├── ItemRow "恢复日奖励"（图标使用官方 Icon）
├── ItemRow "一起加成"（图标使用官方 Icon）
├── ItemRow "金币规则"（图标使用官方 Icon）
└── ItemRow "其他说明"（图标使用官方 Icon）
```

**改造要点：**
1. 将所有规则卡片从独立大卡片（`app-card--panel app-card--item` + 独立阴影）改为 SectionPanel 内的轻量 ItemRow
2. ItemRow 不额外叠加项目阴影、不覆盖官方阴影；通过选择更轻量的官方组件结构降低压迫感，依赖 SectionPanel 的统一背景
3. 每条 ItemRow 标题图标使用官方 Icon 组件（不得用 emoji）+ 规则内容
4. 规则内容中的数字高亮**不得**使用 `ui-text-primary` / `ui-text-reward` 等私有颜色 class。方案二选一：(a) 迁移为 `AppTextAccent` / `AppChip` wrapper，视觉从官方文档设计值 / 官方组件 computed style 提取；(b) 证明这些 class 的值来源于官方文档设计值或官方组件 computed style 并在本文档记录来源。未经证明的私有颜色 class 视为违规

**验收标准：**
- 规则说明像一张公告栏，不是"多张独立卡片"
- 纸条之间不叠阴影
- 规则内容可读性不受影响

---

## 11. 禁止事项

### 11.1 绝对禁止

| 禁止 | 原因 |
|---|---|
| 再造一套项目自定义主题色 | 官方文档设计值和组件实际渲染结果已是真相源 |
| 在文档中反向规定官方 Button/Card/Input 的颜色、边框、阴影具体值 | 官方组件实际渲染结果才是真相；文档只能引用"官方 AnimalButton/AnimalCard/AnimalInput 实际渲染效果" |
| `app-card--*` 设置 border-radius、background、border、box-shadow | 这些全部由官方 AnimalCard 提供；app-card--* 只做布局层 |
| 引用 `animal-island-ui/dist/` 内的 hash class（如 `.animal-divider-ZBhpE`） | hash 随版本变化；优先用官方导出组件，素材复制到 public 并登记 |
| 用大面积 mint teal (`#19c8b9`) 当背景或主题色 | mint teal 是强调色，仅用于选中态/chip/active 导航 |
| 回到粉色主题 (`#ff8aa0` 等) | 已全面迁移到官方暖色色板 |
| 绿色背景上直接漂浮大量白框 | 违反"白框问题"规则 |
| 用 PageBoard / AppCard 控制整页位置 | 页面位置、滚动、高度、TabBar 避让只能由 AppFrame 负责 |
| 任何页面内容主卡片无可见边界 | 内容主卡片如存在，必须使用 AppCard/AnimalCard，边界视觉由官方组件提供 |
| 页面组件自行写大 margin-top / padding-top / padding-bottom / min-height 凑位置 | 所有页面头尾间距统一由 AppPageHeader / AppPageContent / BottomTabBar 提供 |
| 为装饰制造顶部大空白 | 已修过，不要再引入 |
| 修改业务逻辑、热力图计算、结算规则 | UI 层改动不得触及 `lib/home/` |
| 修改 `HomeResourcesProvider.tsx` | 状态编排器不动 |
| 修改 store / snapshot | 数据层不动 |
| 手写仿冒官方组件视觉的 CSS | `app-*` class 只做布局 |
| 底部导航使用 `.app-button--nav` | BottomNav 是独立语义，使用 `.app-bottom-nav-item`（未来 `AppBottomNavItem`） |
| 可见按钮使用裸 `<button>`+ 自绘 CSS | 必须通过 AppButton → AnimalButton。仅 AppDialogBackdrop 例外 |
| 使用裸 `<a>` + 手写 class 作按钮视觉 | 必须使用 AppButtonLink（渲染 `<a>`，视觉复用 AnimalButton） |
| 默认用 `app-dialog-shell`/`app-dialog` 自绘弹窗 | 先确认 AppModal → AnimalModal 是否可承载 |
| 默认用 `.animal-panel-group` 自绘容器 | 先确认 AppCard → AnimalCard 是否可承载 |
| 以"颜色不要改"锁定热力图色板 | 业务逻辑不动，但色板应迁移到 官方文档设计值 / 官方组件 computed style |
| emoji 作为最终装饰方案（含标题图标、按钮图标、伪元素 chrome） | 必须替换为 AppGameIcon / AppRoleAvatar / AppCurrencyChip / AppHeatmapMarker / 官方稳定素材 |
| 热力图色板使用 pink/rose 系颜色 | 允许色板：parchment/yellow/green/mint/brown |
| `<a>` 内部嵌套 `<button>` | HTML 规范禁止交互元素嵌套；AppButtonLink 通过复用 CSS 达到 AnimalButton 视觉 |
| `ui-tab-active` 设置 color/background/border/shadow | 优先使用官方 Tabs；fallback 时 `ui-tab-active` 仅表达状态或布局，视觉由 AnimalButton 提供 |
| fallback 控件凭感觉写视觉数值 | 必须从 DevTools 提取官方组件实际 computed CSS 值 |
| 项目 token 硬编码私有色板值 | 项目 token 值必须来自官方文档设计值或官方组件 computed style。`--shadow-button`/`--shadow-input` 等 token 仅限已登记 fallback 使用，不得覆盖官方组件 |
| 使用 `.animal-stage` / `.animal-panel-group` / `.animal-item-row` / `.animal-phone-panel` 作为首选容器方案 | 这些是遗留 fallback class；默认必须使用 `<AppCard>` → `AnimalCard` |
| 使用 `.animal-page` / `.animal-stage` 作为页面 shell 或定位层 | 这些是历史页面骨架；唯一页面骨架是 AppFrame |
| 长期保留 `AppButton` + `.app-bottom-nav-item` 过渡方案 | AppBottomNavItem 必须在 Phase 2 前抽出，内部使用 AnimalButton |
| 预设底部 Sheet 例外（不做用户确认就默认登记） | 所有弹窗默认居中；底部 Sheet 需用户逐实例确认后才能登记 |
| `app-dialog-shell` / `app-dialog` 作为合规弹窗方案 | 它们是待迁移遗留结构；必须逐实例证明 AnimalModal 无法承载后才能使用 |
| 项目 token 值无来源记录 | 项目 token 值必须来自官方文档设计值 / 官方组件 computed style / 官方 demo 来源记录；不得凭感觉自创 |
| 文档中规定"半透明暖色底 + 细边框 + 圆角"等视觉描述 | 容器视觉由 AppCard/AnimalCard 实际渲染提供，不反向规定 |
| 自绘 `app-card--hero::before` 虚线装饰 | 装饰必须来自官方 Divider 组件或稳定素材 |
| 新增 CSS radial-gradient ambient glow | 背景/氛围使用官方图片素材，已有 ambient glow 登记为临时遗留 |
| 业务页面中散落自绘 Chip/Heatmap/Progress/Sync 样式 | 必须封装为 AppChip/AppHeatmap/AppProgress/AppSyncStatus wrapper |
| 弹窗标题/正文规定项目私有字号（10px/text-lg/text-xs） | 字号遵循 AnimalModal 官方排版 |
| `app-back-button` 或裸文本返回作为 PageHeader 返回 | 必须使用 AppButton / AppHeaderBackButton，不能裸文本、不能大胶囊 |
| 项目 token 或视觉数值无来源记录 | 任何视觉数值必须有来源（DevTools 记录 / 官方文档设计值 / 官方 demo URL） |
| `ui-text-primary` / `ui-text-reward` 等私有颜色 class 作为数字高亮方案 | 必须迁移为 AppTextAccent/AppChip wrapper，或证明其值来源于官方文档设计值或官方组件 computed style 并记录来源 |
| `.app-top-status` 半透明渐变等视觉值凭感觉自绘 | TopStatus 属于 AppSyncStatus wrapper；背景/渐变/透明度必须从官方 computed style 或官方素材提取并记录来源 |
| `AppDialogBackdrop` 硬编码 `rgb(...)` / `blur(...)` 数值 | 必须从 AnimalModal 实际 backdrop computed CSS 提取并记录来源 |
| `app-button--nav` 设置 font-weight | 按钮文字视觉（含 font-weight）由 AnimalButton 官方样式提供 |
| `app-textarea` 把 border-radius 当布局属性 | border-radius 不是布局属性；必须从 AnimalInput computed style 提取 |
| `app-input-shell` 自由设置 border-radius | border-radius 必须从 AnimalInput computed style 提取并登记来源 |
| `.app-bottom-nav-item` 自定 transform/pressed 位移 | pressed 态视觉由内部 AnimalButton 官方状态提供；如需位移必须从 AnimalButton computed :active 提取并登记 |
| `.app-bottom-bar` 凭感觉自绘半透明渐变背景 | 背景/渐变/透明度必须从官方素材或官方组件 computed style 提取来源记录；否则仅作布局容器 |
| `app-main-inner` / `app-main-scroll` 旧说明作为最终页面骨架依据 | 改用 AppFrame / AppPageScroll / AppPageContent 规范 |

### 11.2 应避免

| 避免 | 替代方案 |
|---|---|
| 大面积 `ui-tinted-*` 背景 | 用 SectionPanel 统一背景，条目用细边框或左边框颜色标记区分 |
| 每个条目独立阴影 | 不额外叠加项目阴影、不覆盖官方阴影；通过减少嵌套层级或选择更轻量的官方组件结构降低压迫感 |
| 大模糊圆 ambient blob 或 CSS radial-gradient ambient glow | 移除，用官方图片素材或官方组件替代 |
| 弹窗动画不一致（有的底部 Sheet 有的居中） | 默认居中弹窗；底部 Sheet 仅已登记例外 + 移动端触发 |
| Toast 样式不一致 | 统一使用 `app-toast` |
| emoji 作为主力装饰 | emoji 仅限文档语义占位（`[Icon: xxx]`）；实现时替换为 AppGameIcon / AppRoleAvatar / AppCurrencyChip / AppHeatmapMarker / 官方素材。素材暂缺时登记为未完成项 |
| `app-card--*` 写 border-radius 覆盖官方 Card | app-card--* 只做布局层；容器优先用 AppCard |
| 下载/外链用裸 `<a>` 或 Next.js `<Link>` 包 blob | 统一用 `AppButtonLink` 渲染真实 `<a>`，视觉复用 AnimalButton |
| 底部导航复用 `AppButton` + 手写 class（长期） | 抽成 `AppBottomNavItem` 独立组件 |
| 直接引用 `dist/` hash class | 优先用官方导出组件，素材复制到 public |
| 返回/删除等可见按钮裸写 `<button>` | 必须用 AppButton → AnimalButton |
| 弹窗默认 app-dialog-shell | app-dialog-shell 是待迁移遗留结构；先试 AppModal → AnimalModal |
| 容器默认 .animal-stage/.animal-panel-group | .animal-stage/.animal-panel-group 是遗留 fallback；默认用 AppCard → AnimalCard |
| fallback 控件自造视觉数值 | 从官方组件 DevTools computed CSS 提取参数 |
| emoji 作为标题图标或装饰 | 实现时必须替换为 AppGameIcon / AppRoleAvatar / AppCurrencyChip / AppHeatmapMarker / 官方稳定素材 |
| 项目 token 值与官方文档设计值 / computed style 不一致 | DevTools 审计后修正项目 token |
| 功能入口使用 .app-button--nav（长期） | 考虑迁移到 AnimalButton variant 或独立组件 |
| 底部 Sheet 作为默认移动端弹窗方案 | 默认居中；底部 Sheet 需用户逐实例确认 |

---

## 12. 分阶段实施计划

### 历史阶段（已执行 / 已过时）

旧 Phase 0-6（wrapper 审计、官方视觉恢复、PageBoard/PhonePanel 结构、商店/日志列表、弹窗统一、素材装饰、最终视觉审计）属于历史迁移记录。后续 Codex 不得继续按旧 Phase 2 的“PageBoard 控制页面结构”或旧 Phase 5 的“emoji 临时装饰”方式推进。

旧 Phase A/B/C/D 如出现在历史记录中，均视为历史方案，不再作为当前执行计划。

### Phase 6.9：AppFrame / PageHeader / BottomTabBar 统一（当前下一阶段）

目标：建立唯一页面骨架，修复所有页面头部、滚动区、底部 TabBar 的不一致。

必须完成：

- 建立 AppFrame：`AppFrame` / `SyncStatusBar` / `AppPageHeader` / `AppPageScroll` / `AppPageContent` / `BottomTabBar`。
- SyncStatusBar 固定顶部。
- AppPageHeader 固定在 SyncStatusBar 下方，所有页面同高度。
- 一级 Tab 页面只显示居中标题，无返回按钮。
- 小窝二级页左侧轻量返回、标题居中。
- AppPageScroll 是唯一滚动容器，内容永远不进入 BottomTabBar 区域。
- AppPageContent 统一 `max-width`、顶部 padding、底部 breathing space、gap。
- BottomTabBar 固定底部，有独立背景和顶部细分隔线。
- `activeTab` / `nestView` 切换时 AppPageScroll 滚动回顶部。
- 移除页面组件用于凑位置的大 `margin-top` / `padding-top` / `padding-bottom` / `min-height` / `70dvh` / `100dvh`。
- 移除商店、成长日志等页面重复 TabBar 避让 padding。
- AppCard / 历史 PageBoard 只保留为内容卡片，不再控制页面定位。

禁止：

- 不得新增复杂页面抽象体系替代 AppFrame。
- 不得把 BottomTabBar 放回普通文档流。
- 不得通过 AppCard 的 margin/padding/min-height 修整页位置。
- 不得改业务逻辑、数据结构、热力图日期/grid/level、兑换逻辑、成长日志逻辑、弹窗业务逻辑。

### Phase 7：小鱼 / 小猫头像上传系统（后续）

目标：为小鱼和小猫建立可配置头像系统。

必须在 Phase 6.9 骨架稳定后再进入。Phase 7 不得夹带页面骨架修复，不得回滚 AppFrame 规范。

---

## 13. 验收标准

### 13.1 自动化
- `npm run lint` — 通过
- `npm run build` — 通过
- `npm run test` — 与基线一致

### 13.2 逐页肉眼验收

**全局：**
- [ ] 背景是 parchment 纹理（`content_bg_pc.jpg`），不是绿色渐变
- [ ] 无粉色残留
- [ ] 无 `text-white` 覆盖 `app-button--primary`
- [ ] 所有页面使用同一个 AppFrame 骨架
- [ ] 顶部 SyncStatusBar 固定在最上方
- [ ] 所有页面都有同一个 AppPageHeader 位置和高度
- [ ] 一级 Tab 页面没有返回按钮
- [ ] 小窝二级页使用统一返回按钮，位置一致、样式一致
- [ ] 返回按钮不是裸文本、不是裸 `<button>`、不是大胶囊，必须通过 AppButton / AppHeaderBackButton wrapper
- [ ] AppPageScroll 是唯一页面滚动容器，window/body 不承担主要滚动
- [ ] BottomTabBar 固定底部，独立背景，顶部细分隔线清晰
- [ ] 内容区滚动到底部时不进入 BottomTabBar 区域
- [ ] 所有页面尾部只保留统一 AppPageContent breathing space
- [ ] 不允许页面单独写大 margin/padding/min-height 来凑顶部或底部位置
- [ ] 所有可见按钮/输入框/卡片/弹窗/Tab 显示为官方 animal-island-ui 实际渲染效果
- [ ] 底部导航使用 `AppBottomNavItem` 组件（内部 AnimalButton），不是 `.app-button--nav`
- [ ] 所有已登记例外在本文档第 9.2 节有明确记录
- [ ] 无裸 `<button>`（仅 AppDialogBackdrop 例外）
- [ ] 无裸 `<a>` 用作按钮视觉（全部通过 AppButtonLink）
- [ ] `components/home/**` 无散落 UI emoji；图标走 AppGameIcon / AppRoleAvatar / AppCurrencyChip / AppHeatmapMarker / 官方素材

**今日页：**
- [ ] 像岛屿公告板，内容主卡片有可见边界（优先 `AppCard variant="panel"`）
- [ ] 不是"内容直接散落在 parchment 背景上"
- [ ] 装饰轻量，不抢内容

**地图页：**
- [ ] 像成长地图板，hero card 为大地图板外框
- [ ] 热力图色板已迁移到 官方文档设计值 / 官方组件 computed style

**兑换商店：**
- [ ] 像 Nook 小商店货架
- [ ] 商品是轻量行条目（`AppCard variant="item"`），不是独立大卡片
- [ ] 宝石区和金币区有区分但不割裂

**小窝：**
- [ ] 像 NookPhone 设置页
- [ ] PhonePanel 有可见边界（优先 `AppCard`），内容不散落在背景上
- [ ] 子页面 header 统一为 AppPageHeader；不再在内容卡片内部重复 NestSubPageHeader
- [ ] 功能入口使用 `.app-button--nav`，与底部导航明确不同

**成长日志：**
- [ ] 像手账本/便签册
- [ ] 记录行轻量，列表不压迫
- [ ] 详情/编辑弹窗居中显示（优先使用 `AppModal`），不是底部 Sheet

**数据管理：**
- [ ] Toast 统一使用 `app-toast`，无 rose 色系
- [ ] 下载链接使用 `AppButtonLink`
- [ ] 文件选择器使用原生 `<input type="file">`

**规则说明：**
- [ ] 像一张公告栏，不是"多张独立厚卡片浮在背景上"
- [ ] 规则纸条轻量（优先 `AppCard variant="item"`），不叠阴影

### 13.3 弹窗验收
- [ ] 简单确认弹窗使用 `AppModal` → `AnimalModal`（非 `app-dialog`）
- [ ] 复杂表单弹窗已评估 `AppModal` 承载力；不可承载的已登记 fallback 原因
- [ ] 所有业务弹窗默认居中（PC 端全部居中；移动端仅已登记例外使用底部弹出）
- [ ] 同类弹窗宽度统一
- [ ] 标题区结构统一（标签 + 标题 + 副标题）
- [ ] 按钮区结构统一（次要左 + 主要右）
- [ ] Backdrop 使用 `AppDialogBackdrop`（`<button>` 元素，已登记例外）
- [ ] 弹窗打开时底部导航被遮罩覆盖

### 13.4 代码质量
- [ ] wrapper 审计完成：AppButton/AppCard/AppInput 无视觉覆盖，审计结果记录在 `docs/ui-migration-report.md`
- [ ] fallback 输入控件（app-compact-control/app-textarea/app-input-shell）视觉参数与 AnimalInput 实际渲染值一致
- [ ] `AppFrame` / `AppPageHeader` / `AppPageScroll` / `AppPageContent` / `BottomTabBar` 是唯一页面骨架
- [ ] `animal-page` / `animal-stage` / `app-main-inner` / `app-main-scroll` 旧页面定位说明不再作为实现依据
- [ ] AppCard / 历史 PageBoard 不控制整页顶部位置、底部位置或滚动容器高度
- [ ] globals.css 中 `app-card--*` 无 border-radius/background/border/box-shadow 覆盖
- [ ] globals.css 中 `app-button--*` / `app-input` 无视觉覆盖
- [ ] fallback class 使用项目 token 变量（token 值已对齐官方组件实际值）
- [ ] `.app-bottom-nav-item` 独立于 `.app-button--nav`；优先 `AppBottomNavItem` 组件
- [ ] 下载链接/外链使用 `AppButtonLink`（渲染 `<a>`，视觉复用 AnimalButton）
- [ ] Tab 切换优先使用 animal-island-ui `Tabs` 组件（如可用）
- [ ] checkbox/switch 审计完成：有官方组件则已替换
- [ ] 返回按钮/弱删除按钮使用 `AppButton variant="ghost"` 或专用 wrapper，无裸 `<button>` 自绘
- [ ] 项目中无对 `animal-island-ui/dist/` hash class 的直接引用
- [ ] UI emoji 已替换为 AppGameIcon / AppRoleAvatar / AppCurrencyChip / AppHeatmapMarker / 官方稳定素材
- [ ] 热力图色板已迁移到 官方文档设计值 / 官方组件 computed style
- [ ] 业务逻辑文件（`lib/home/`）未被修改
- [ ] `HomeResourcesProvider.tsx` 未被修改
