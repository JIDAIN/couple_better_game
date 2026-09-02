# 岛屿生活 Design System

这份文档定义 V2 生活系统的长期视觉语言。目标不是“把所有页面都套成游戏 UI”，而是建立一套统一、可扩展、适合高频记录和数据展示的「岛屿生活」界面语言。

## 1. 核心目标

```text
统一 > 花哨
可读 > 主题化
成熟交互优先 > 重复造轮子
岛屿感来自整体语言 > 来自某一个组件库
```

`animal-island-ui` 是基础组件来源之一，不是整个 Design System 本身。

当官方组件不足以承载生活、药箱、日历、体重等场景时，可以设计新的项目组件，但必须遵守本文件的视觉规则，并优先封装到 `components/ui/App*`，不能在业务 JSX 中散落第二套视觉体系。

## 2. 当前依赖与升级策略

当前 `package.json` 声明：

```text
animal-island-ui ^1.0.1
```

当前 lockfile 实际锁定 1.0.1。上游当前已经提供 1.8.x 系列，公开设计系统中包含更完整的 DatePicker、TimePicker、Drawer、Tabs、Table、Tag、Notification、Progress、Skeleton、Image、Carousel 等组件。

V2-UI0 阶段的策略是：

1. 不直接在生产 `main` 上升级；
2. 在 `v2/ui-foundation` 做兼容性审查；
3. 先建立 `/ui-lab`，把项目 wrapper 和新增 Pattern 放到同一页面观察；
4. 升级库时必须先通过 Test / Lint / Build，再做真实视觉检查；
5. 升级不能成为顺手重写旧游戏 UI 的理由。

## 3. 视觉语言

V2 的“动森感”不是像素级复制游戏，而是以下视觉语法的组合：

- 暖奶油 / 土地 / 木头 / 叶片 / 海水类自然色；
- 大圆角、胶囊、软方形和少量有机轮廓；
- 轻微立体按压感，而不是重度玻璃拟态或企业后台阴影；
- 纸张、便签、公告板、收纳柜、信箱等生活物件语义；
- 轻松但清楚的字体层级；
- 动画短、柔和、可预期，不使用持续抢注意力的装饰动画；
- 可爱元素是点缀，数据本身保持清楚。

### 主题浓度规则

```text
信息密度低 -> 主题可以更明显
信息密度高 -> 主题退到容器和层级，数据本身保持克制
```

例如：

- 首页心情选择可以有明显岛屿风；
- 药箱列表可以有收纳柜 / 标签语义，但药名、数量、日期必须一眼可扫；
- 体重折线图只在外层使用岛屿视觉，图表内部保持干净；
- 日历保留标准 7 列日期心智模型，只重新设计日期格和状态标记。

## 4. 70 / 20 / 10 检查法

这是设计检查方法，不是硬性比例：

- 约 70%：熟悉、稳定、容易理解的普通 UI 行为；
- 约 20%：岛屿色板、圆角、材质、排版和容器；
- 约 10%：角色化、物件化、微动画等强识别表达。

如果主题化后用户需要额外判断“这是不是按钮”“这个木牌能不能点”，说明已经过度主题化。

## 5. UI 获取优先级

新增可见 UI 时按以下顺序判断：

```text
A. 已有 App* wrapper
B. 当前/候选 animal-island-ui 官方组件
C. 同视觉语言、许可允许的成熟开源 Pattern
D. 成熟 headless / 通用组件库，仅借交互能力
E. 项目原创组件
```

从 0 写不是默认方案。

### 开源复用原则

允许复用的内容分三类：

1. **同风格组件**：可以移植结构、交互和部分视觉，再统一到 App*；
2. **异风格成熟组件**：只借状态、算法、布局逻辑和交互，不携带原色板/阴影/按钮；
3. **受限或授权不明确资源**：只做设计参考，不直接复制代码或游戏资产。

任何外部代码进入业务页面前都必须经过项目适配层。

## 6. 当前参考仓库

### `guokaigdg/animal-island-ui`

用途：基础组件、视觉词汇、Design Tokens、交互组件候选。

注意：当前上游许可证为 CC BY-NC 4.0。项目目前是私人用途；如果未来商业化，需要单独重新评估依赖授权。

### `TIUCSIB/animal-island-blog`

用途：应用级 Pattern 参考，例如 Timeline、Empty State、Popover、Toast、Stat Card 等。

策略：优先吸收交互与结构，转换为项目自己的 `App*` / Life Pattern。

### `AshleyCry/AnimalIslandNewTab`

用途：完整应用级组合参考，例如 CardWithTitle、Settings Sidebar、Sidebar、Calendar、快捷入口和设置界面。

策略：参考“小窝”和二级功能入口的空间组织，不复制浏览器插件业务层。

### `guowenju/portal-os`

用途：App Grid、桌面/应用入口、隐藏工具入口、空间化信息架构参考。

策略：适合未来“小窝 / 游戏机 / 家庭药箱 / 信箱”入口组合，不把桌面操作系统模式照搬到手机主流程。

### `CheapNightbot/our-days`

用途：月度 / 年度 emoji 心情日历的数据组织和交互逻辑。

策略：借日期与 emoji 映射逻辑，不直接采用普通 SaaS 风格 Card。

## 7. 项目组件分层

```text
基础库 / headless
        ↓
components/ui/App*
        ↓
可复用 Pattern
        ↓
components/life / nutrition / weight / medicine
```

### Foundation / Primitive

优先由官方库 + App* 提供：

```text
Button
Input
Select
Modal / Drawer
Card
Tag
Date / Time Picker
Tabs
Tooltip
Loading / Skeleton
```

### Project Pattern

项目需要长期拥有：

```text
AppPageShell
AppSectionPanel
AppRecordRow
AppEmptyState
AppPopover
AppToast
AppTimeline
AppFeatureTile
AppMonthCalendar
```

这些不是某个业务域专属。

### Life Components

真正体现产品独有体验：

```text
MoodPicker
SleepRecord
ActivityNote
DualMoodCalendarDay
MedicineItem
PartnerNote
```

只有这一层允许较多原创视觉。

## 8. V2 首页的主题浓度

首页信息量低，允许主题感相对最强，但仍只显示：

```text
心情
睡眠
活动
```

不把饮食、体重、药箱、信箱重新塞回首页。

设计目标：

- 心情：像选择今天的小状态徽章，单击即可完成；
- 睡眠：用 `月亮 -> 时间 -> 太阳` 的直观关系表达，不做评分卡；
- 活动：像当天手账里的小纸条，可连续添加；
- 不使用金币、经验、排名、连续打卡等 Legacy Game 视觉语义。

## 9. `/ui-lab`

`/ui-lab` 是 V2 的视觉实验室，不是正式产品导航。

用途：

- 同时查看核心 App*；
- 对比不同主题浓度；
- 验证 Mood / Sleep / Activity 静态 Pattern；
- 升级 `animal-island-ui` 时集中检查兼容性；
- 后续药箱、日历、体重组件先在这里对齐视觉，再进入业务页面。

要求：

- `/ui-lab` 不读写真实生活数据；
- 不连接 Legacy Game settlement；
- 不作为业务入口；
- 视觉通过后再接真实 Life API。

## 10. 不允许的做法

- 为了“更像动森”改变用户熟悉的日期、表单和数据交互模型；
- 每个页面从 GitHub 搬一套独立色板；
- 直接把外部 Tailwind class / CSS 文件整包复制进业务层；
- 在药箱、图表、日历等高密度界面堆大量树叶、角色、木纹；
- 用 Nintendo 官方游戏图标/资产作为项目长期核心资源；
- 因为 V2 重做生活系统而顺手重写 Legacy Game；
- 把 `/ui-lab` 的实验状态误写成 production 已上线。

## 11. V2-UI0 完成标准

V2-UI0 完成前不进入完整 V2 首页实现。

最低标准：

- [ ] 建立 `/ui-lab`；
- [ ] Mood / Sleep / Activity 三个静态 Pattern 在同一页可对比；
- [ ] 当前 App* 关键组件有代表性样例；
- [ ] 完成 `animal-island-ui 1.0.1 -> 1.8.x` 兼容性审查；
- [ ] 明确哪些新官方组件值得包装；
- [ ] Test / Lint / Build 通过；
- [ ] Vercel Preview 可打开 `/ui-lab`；
- [ ] 视觉人工确认后，才决定依赖升级和 V2-P2 首页接 API。
