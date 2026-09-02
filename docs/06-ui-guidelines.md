# UI 与 animal-island-ui 维护规范

## 1. 视觉规范优先级

V2 生活系统的唯一主视觉规范：

```text
docs/12-island-life-design-system.md
```

任何 V2 首页、饮食、日历、小窝、体重、小信箱、家庭药箱、游戏机或未来页面，必须先遵守该文档。

`animal-island-ui` 仍是基础组件来源，但不是完整设计语言。组件不足时允许项目自己设计，只能通过统一 token / App* / Pattern 实现。

## 2. V2 token

V2 视觉 token 位于：

```text
app/island-life-tokens.css
```

统一使用 `--life-*`：

- 暖白 / 奶油白背景；
- 薄荷 / 青绿主识别；
- 柔黄 / 珊瑚 / 浅蓝辅助；
- 深灰绿文字；
- 统一圆角、阴影、间距和动效。

禁止在 V2 业务页面重新发明大面积棕色、页面专属色板、第二套阴影系统。

Legacy Game 继续使用现有旧 token，V2 不要求顺手重做 `/game`。

## 3. UI 分层

```text
第三方 primitive / headless
        ↓
components/ui/App*
        ↓
跨域 Pattern
        ↓
components/life / nutrition / weight / medicine / games
```

当前已实现的 V2 Pattern：

```text
AppPageShell
AppRoleSwitch
AppRecordRow
AppFeatureTile
AppNutritionBar
```

业务页面优先组装这些 Pattern，禁止为了快在 JSX 中重新造同类样式。

## 4. 双人切换

V2 事实页统一：

```text
我 / Ta
```

饮食、体重等单人查看页面使用 `AppRoleSwitch`。默认不做双人左右对照。

## 5. 首页

正式首页只允许：

```text
心情
睡眠
活动
```

且三项都要有记录/编辑入口。

- 心情继续用彩色情绪圆脸，不能替换成人物头像；
- 睡眠只记入睡与起床；
- 活动统一承载学习/运动/散步/游玩；
- 饮食、体重、小信箱、药箱不放回首页；
- 不使用金币/宝石/排名/streak 等 Legacy Game 语义。

## 6. 饮食

独立饮食页：

- 顶部 `我 / Ta`；
- 一次只看一人；
- 早餐 / 午餐 / 晚餐 / 加餐；
- 左侧真实照片；
- 右侧碳水 / 蛋白质 / 脂肪 / 总热量；
- 每餐编辑按钮；
- 底部当日宏量营养 + 总热量；
- 编辑进入「编辑一餐」子页面。

必须复用现有 Meal CRUD / `DailyMealsPanelCore` 的数据逻辑，不重建第二套餐食体系。

## 7. 日历

- 标准七列月历；
- 同日显示双人心情圆脸；
- 点击日期进入日历详情；
- 详情回顾心情、睡眠、活动、饮食概览；
- 不做打卡绩效。

## 8. 小窝

固定入口：

```text
体重 / 小信箱 / 家庭药箱 / 游戏机
```

### 体重
`我 / Ta` + 当前值 + 周/月/年趋势 + 折线图 + 最近记录。

### 小信箱
信纸卡片；收到的 / 我写的；列表主体不用头像。

### 家庭药箱
搜索 / 筛选 / 药名 / 规格 / 数量 / 保质期 / 存放位置；高密度信息必须克制。

### 游戏机
只做游戏列表。本轮当前游戏为宝石金币游戏并链接现有 `/game`；未来可扩展更多游戏，不开发新的旧游戏详情页。

## 9. 开源复用

新增 UI 优先级：

```text
已有 App*
-> animal-island-ui 已验证组件
-> 同风格、许可允许的成熟 GitHub Pattern
-> 成熟 headless 交互
-> 项目原创
```

异风格项目只借状态/逻辑/结构。颜色、圆角、阴影、Button、Card、Input 必须重新归一。

## 10. `/ui-lab`

`/ui-lab` 是 V2 视觉回归页：

- 只用假数据；
- 不读写 Supabase；
- 不调用真实 Life API；
- 不触发 Legacy Game settlement；
- 新 Pattern 先在此校验，再进入业务页面。

## 11. 移动端和数据可读性

- 触控目标清楚；
- safe-area 不遮挡；
- 长中文不溢出；
- 数字使用稳定对齐；
- loading / empty / error 可见；
- 图表/药箱等高密度页面减少插画；
- 可爱不能降低扫描效率。

## 12. 验证

可见 UI 最低：

```text
npm run test
npm run lint
npm run build
```

并在 Vercel Preview 人工检查窄屏、长内容、交互状态和统一性。未做真实视觉检查时，不写“视觉已验证”。
