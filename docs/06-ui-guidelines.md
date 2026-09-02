# UI 与 island-life Design System 维护规范

## 1. 视觉规范源

V2 生活系统的**唯一主视觉规范**是：

```text
docs/12-island-life-design-system.md
```

所有首页、饮食、日历、小窝、体重、小信箱、家庭药箱、游戏机及未来新增页面，在开始编码前都必须先阅读并遵守该文件。

`animal-island-ui` 是基础组件来源，不等于完整视觉语言。

如果组件库不足，可以新增项目组件，但不得绕开统一视觉语言。

## 2. UI 层级

### 基础库

当前项目继续使用 `animal-island-ui` 及必要的成熟 headless / 通用交互能力。

### `components/ui/App*`

项目 adapter/wrapper，负责把底层 UI 能力归一到岛屿生活视觉语言。

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

V2 后续应补充：

```text
AppPageShell
AppRecordRow
AppEmptyState
AppPopover
AppToast
AppFeatureTile
AppMonthCalendar
AppRoleSwitch
```

### 业务 UI

```text
components/life/*       生活事实
components/nutrition/*  饮食
components/weight/*     体重
components/medicine/*   家庭药箱
components/games/*      游戏入口/未来小游戏
components/home/*       Legacy Game
```

业务页面优先组合 App* / Project Pattern，不在页面 JSX 中重新创造一套 primitive。

## 3. 使用优先级

新增可见 UI 时：

```text
已有 App* wrapper
-> 已确认可用的 animal-island-ui 组件
-> 同视觉语言、许可允许的成熟 GitHub Pattern
-> 成熟 headless / 通用库交互能力
-> 项目原创组件
```

从 0 写不是默认方案。

外部项目与本项目视觉不同，只允许借：

- 交互；
- 状态；
- 日期算法；
- accessibility；
- 响应式布局；
- Timeline / Popover / Toast / Drawer 等成熟 Pattern。

不能直接复制其色板、阴影、按钮、Card 或整包 CSS。

## 4. 统一视觉底线

以下规则为强制：

- 背景以暖白/奶油白为主，不回到大面积棕色；
- 主识别为薄荷/青绿，黄/珊瑚粉/浅蓝作辅助；
- 暖感来自暖白、奶油、柔黄和珊瑚色，而不是木棕铺满页面；
- 高信息密度页面减少插画，数据优先；
- 圆角、阴影、字体、状态色必须由统一 token / App* 管理；
- 页面不能因为来源不同而看起来像不同 App；
- 生活系统不复用 Legacy Game 的金币/宝石/排名/热力图视觉语义。

视觉细节和具体页面结构见 `docs/12-island-life-design-system.md`。

## 5. 主导航（V2 定稿）

V2 生活系统主导航：

```text
今日 / 饮食 / 日历 / 小窝 / 我的
```

旧游戏的 `今日 / 地图 / 兑换 / 小窝` 只属于 Legacy Game，不再作为 V2 生活系统主导航。

旧游戏从：

```text
小窝 -> 游戏机 -> 宝石金币游戏
```

进入。

## 6. 今日页规则

只显示：

```text
心情
睡眠
活动
```

每块都必须有明确记录/编辑入口。

- 心情继续使用彩色情绪圆脸，不用人物头像替代；
- 睡眠只记录入睡/起床及派生时长，不评分；
- 活动是统一概念，不在首页拆成学习/运动/散步任务；
- 活动临时人物只使用女性动森风角色，待用户提供双方真实角色素材后统一替换；
- 首页不放饮食、体重、药箱、小信箱或旧游戏资源。

## 7. 饮食页规则

饮食已从旧游戏 Provider 代码层解耦，V2 产品层改为独立主页面。

顶部统一切换：

```text
我 / Ta
```

不是双人同屏对照。

按早餐 / 午餐 / 晚餐 / 加餐展示，每餐固定信息层级：

```text
左侧  实际餐食照片
右侧  碳水 / 蛋白质 / 脂肪 / 总热量
右上  编辑入口
```

底部显示当天总摄入：

```text
碳水 / 蛋白质 / 脂肪 / 总热量
```

禁止恢复：

- 本周饭历；
- 印章墙；
- 打卡收集；
- 我和 Ta 同屏摄入对照；
- 固定食物插画冒充真实餐食照片。

编辑一餐是饮食子页面，新增和编辑共用同一结构。

## 8. 日历规则

主日历采用标准七列月历，每天显示双方心情小圆脸。

点击日期进入日历详情页，按当天事实回顾：

```text
心情
睡眠
活动
饮食概览
```

日历不做成绩、连续打卡、成功率等评价。

## 9. 小窝与子页面

小窝固定四个入口：

```text
体重
小信箱
家庭药箱
游戏机
```

### 体重

- 顶部 `我 / Ta` 切换；
- 当前体重；
- 周/月/年趋势；
- 折线图；
- 近期记录；
- 记录体重入口。

### 小信箱

- `收到的 / 我写的`；
- 使用信纸卡片，不用人物头像列表；
- 不做写信次数/连续记录评价。

### 家庭药箱

- 搜索 + 轻筛选；
- 药名 / 规格 / 数量 / 有效期 / 存放位置必须清晰；
- 提供添加/编辑药品页面；
- 不做复杂游戏卡牌。

### 游戏机

本轮只做游戏列表。

当前唯一实际游戏：

```text
宝石金币游戏
```

即现有旧版金币/宝石/兑换机制。

游戏列表必须保留未来新增游戏的接口，但**本轮不设计游戏详情页**。

## 10. 双人文案统一

所有需要切换角色的页面统一使用：

```text
我 / Ta
```

不得在不同页面混用：

```text
我 / 她
我 / 对方
鱼鱼 / 猫猫（除 Legacy Game 自己的旧语义）
```

## 11. CSS 与 Token 职责

新增视觉值优先进入全局 token，不允许在多个页面散落新的 hex 色值、shadow、radius。

项目 CSS 主要负责：

- 页面布局；
- spacing/alignment；
- safe-area；
- responsive；
- 业务专有可视化；
- wrapper adapter。

如果需要新视觉 Pattern：

1. 先确认 `docs/12-island-life-design-system.md`；
2. 优先检查现有 App* / animal-island-ui / 可复用 GitHub Pattern；
3. 在 `/ui-lab` 用假数据验证；
4. 稳定后封装；
5. 再接真实 API。

## 12. `/ui-lab`

`/ui-lab` 是开发实验室，不是视觉规范源。

- 不写真实 Supabase facts；
- 不触发 Legacy Game settlement；
- 用于新组件视觉回归和屏宽检查；
- 若 UI Lab 与 `docs/12-island-life-design-system.md` 冲突，以后者为准。

## 13. 移动端优先

新增 UI 必须检查：

- 触控目标；
- safe-area；
- 底部导航；
- 长中文；
- 数字 tabular；
- loading/empty/error；
- Modal/Drawer/页面表单滚动；
- 饮食有/无图片；
- 月历跨月；
- 药名和到期日过长；
- 图表小屏可读性。

## 14. Legacy Game 视觉边界

旧游戏的地图、兑换、金币、宝石、热力图、成长记录继续维护其现有语义。

V2 视觉改版不能顺手重写旧游戏，也不能把旧游戏视觉语义带回生活首页。

## 15. 视觉变更流程

涉及以下任一项：

```text
主导航
主页面信息架构
基础色板
核心卡片形态
双人切换规则
页面新增一级入口
```

必须先更新 `docs/12-island-life-design-system.md` 并完成人工确认，再开发代码。

普通实现不得自行删减/改写已经确认的页面结构。

## 16. 验证

代码最低要求：

```text
npm run test
npm run lint
npm run build
```

但代码通过不等于视觉通过。

需要人工视觉检查后，才能声称 UI 已验证。
