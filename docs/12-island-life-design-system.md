# 岛屿生活 Design System

这份文档是 V2 可见 UI 的**唯一主视觉规范**。人工确认版本：**岛屿生活 V2 · 方案 B**。

## 1. 核心原则

```text
统一 > 花哨
可读 > 主题化
成熟交互优先 > 重复造轮子
岛屿感来自整体语言 > 来自某一个组件库
记录，不评价；观察，不排名；数字是事实，不是成绩
```

`animal-island-ui` 只是基础来源之一。第三方项目只能按许可证复用逻辑/结构，并通过项目自己的 `App*` / token / visual adapter 归一。

## 2. 色彩与材质

- 暖白 / 奶油白：主背景；
- 薄荷 / 青绿：主识别、选中、轻操作；
- 柔黄：太阳、温暖强调；
- 珊瑚 / 粉：关系与情绪点缀；
- 浅蓝：睡眠、安静信息；
- 深灰绿：正文。

禁止大面积棕色木板 UI。木色只能作为房间地面、纸张等小范围物件语义。

基础 token：`app/island-life-tokens.css`。
R4-R6 页面级统一适配：`app/island-life-refactor.css`。

## 3. 视觉浓度

```text
信息密度低 -> 插画 / 空间构图更明显
信息密度高 -> 主题退到色彩 / 容器 / 微装饰
```

- 今日、小窝：允许明显生活游戏感；
- 月历：像一张柔和纸质月历，情绪直接落在日期下；
- 饮食、体重、药箱：数据可读优先，不做装饰噪声；
- 我的：像设置/账户页，不再堆共同生活功能快捷卡片。

## 4. 统一基础组件

```text
AppPageShell
AppLifeBottomNav
AppRoleSwitch
AppRecordRow
AppFeatureTile
AppNutritionBar
```

R6 新增的视觉 adapter class：

```text
life-page-header / life-page-title / life-page-subtitle
life-bottom-nav / life-bottom-nav-item
life-sheet-backdrop / life-mood-sheet
life-calendar-paper / life-calendar-day / life-calendar-mood
life-nest-scene / life-nest-tile
life-account-hero / life-settings-list / life-settings-row
```

这些 class 只表达统一视觉，不承载业务事实。

## 5. 主信息架构

```text
今日 / 饮食 / 日历 / 小窝 / 我的
```

### 今日
- 心情 / 睡眠 / 活动；
- 心情展示双方，但只能记录当前登录用户；
- 情绪使用真实图标 + 柔和不规则色块，不使用 ASCII 字符脸；
- 睡眠只编辑自己的入睡 / 起床；
- 活动维持统一自由文本事实。

### 饮食
- `我 / Ta` 相对当前登录账号；
- 早餐 / 午餐 / 晚餐为固定槽；
- 加餐为 `0..N`，新增前选上午 / 下午 / 晚上；
- 每餐/每次加餐可有实物图、食物、宏量营养、kcal；
- Ta 只读；
- 不做双方对照列、饭历、streak。

### 日历
- 标准七列日期排布；
- 无心情则日期下方完全留白；
- 今天用小太阳标识；
- 一人有记录显示一枚，双方都有显示两枚轻微错位情绪图；
- 点击日期进入事实详情；
- 不做连续天数、完成率或积极度比较。

日期排布 / mood-under-date 产品模式参考 MIT：
`GitHub-Xzhi/obsidian-mood-calendar`，只借成熟模式，不复制插件视觉或代码。

### 小窝
固定四个共同生活入口：

```text
体重 / 小信箱 / 家庭药箱 / 游戏机
```

小窝主页面顶部允许房间场景感，四入口保持清楚可点击。

#### 体重
- `我 / Ta`；
- 当前体重、趋势、历史；
- 我可编辑，Ta 只读。

#### 小信箱
- 收到的 / 寄出的；
- 纸信/明信片视觉，不使用头像列表；
- 新信固定 `我 -> Ta`；
- 收到的信只读，自己寄出的信可编辑/删除。

#### 家庭药箱
- 搜索 / 筛选；
- 药名 / 规格 / 数量 / 有效期；
- **没有存放位置字段**，因为药统一放在家庭药箱；
- 同名不同批次分开；状态动态计算。

#### 游戏机
- 只做游戏列表；
- `变美变瘦大作战 -> /game`；
- 旧游戏视觉与机制保持独立。

### 我的
只负责当前账户与应用边界：

```text
当前账号
我 / Ta 身份映射
云同步状态
个人写入权限
数据管理边界
退出登录
```

不再重复展示小窝、日历、游戏机快捷卡片。

## 6. “我 / Ta”强制规则

数据库稳定身份：`cat / fish`。
UI 标签始终相对当前登录：

```text
cat 登录：我=cat，Ta=fish
fish 登录：我=fish，Ta=cat
```

所有业务页面必须消费 `LifeIdentityContext` 的 `mePartnerKey / taPartnerKey`，禁止重新写死 `SELF_KEY=cat`。

## 7. 成熟项目/库复用优先级

```text
A. 已有 App* wrapper / 项目 Pattern
B. animal-island-ui 已验证能力
C. MIT/许可兼容的成熟 GitHub Pattern
D. 成熟 headless / 通用库，仅借交互
E. 项目原创组件（最后选择）
```

R1C 原计划优先 TanStack Query。由于本轮通过 GitHub Contents API 修改仓库，不能可靠运行 `npm install` 自动重建完整 lockfile，因此没有手工伪造 lockfile；先建立同一概念边界的 stale-while-revalidate cache。未来可在正常 npm 环境平滑替换。

## 8. 不允许的做法

- 每页单独发明色板；
- 整包复制异风格 GitHub CSS；
- 大面积棕色/木板背景；
- 每个日期都画独立 Dashboard 卡片；
- 用头像代替心情；
- 饮食同时并排比较两人；
- 在生活系统使用金币、经验、排名、streak；
- 把 cat 固定写成“我”；
- 新版生活功能重新塞回 `/game`。

## 9. R6 实施检查

R6 已统一：

- 根页面暖白 + 薄荷/柔黄环境背景；
- 页面标题排版；
- 底部导航材质与激活态；
- 心情 bottom sheet；
- 稀疏情绪月历；
- 小窝房间场景 + 四入口；
- 我的账户/同步设置列表；
- 通用 `life-surface` 透明度与数据页克制程度。

R6 不触碰 Legacy Game 的视觉和结算逻辑。

## 10. 开发与验收流程

1. 先查已有 App* / Pattern；
2. 需要外部方案时确认许可证；
3. 使用 `--life-*` token；
4. 第三方实现经过视觉 adapter；
5. 业务权限不能只靠隐藏按钮；
6. Test / Lint / Build；
7. 只有得到用户该次明确授权后才能 Vercel Preview / Production。
