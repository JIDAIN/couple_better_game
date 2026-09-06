# R8.1 UI 收口

## 背景

R8 的数据管理、共享配置、邮箱元数据、体重目标等底层已经进入主线，但页面视觉和交互没有按“岛屿生活视觉语言”完成最后一轮验收。本轮将用户重新确认的 23 项问题作为 R8.1 验收基线，不再把这些差异留给 R9/R10。

本轮只修改代码、视觉适配、测试和文档；**不触发 Vercel Preview 或 Production**。`vercel.json` 继续保持 `git.deploymentEnabled=false`。

## 纪念日归属

结论：纪念日的主要编辑入口放在 **小窝**，而不是数据管理。

原因：

- `anniversaryDate` 是两个人共同关系的生活信息，而不是技术型备份配置；
- Cat/Fish 都可以修改同一个 `app_configs.anniversary_date`；
- 首页只读取这一个共享值，计算“一起度过的第 N 天”；
- 数据管理/Drive 备份继续包含该配置，但不创建第二套编辑入口或第二份数据。

R8 已有数据库字段和 RPC，本轮只补 `/api/life/settings` 和前端客户端，不新增重复表。

## 23 项收口结果

1. 首页日期下方显示 `一起度过的第 N 天`，使用共享 `anniversaryDate`，起始当天为第 1 天。
2. 心情、睡眠已有数据时右上角统一显示 `编辑`。
3. 首页操作按钮使用圆角描边胶囊视觉。
4. 睡眠圆环以 8 小时为 100%；6h=75%，超过 8h 封顶 100%。
5. 活动点击 `添加` 后立即插入当前列表，不依赖第二次“完成”。
6. 活动 `+ 记录` 与 `编辑` 独立存在；编辑状态只控制已有活动的改删入口。
7. 活动类型增加散步、学习、运动、约会、电影、桌游、旅行、做饭、购物、家务和其他，并复用 `activityType` 字段。
8. 餐食编辑页取消正常编辑状态顶部“返回饮食”与右侧餐次胶囊；餐次仍由入口固定。
9. 餐食照片改成与饮食列表相同的 4:3 小图构图。
10. 照片右侧实时显示碳水、蛋白质、脂肪、总热量。
11. `＋ 上传照片` 直接叠在紧凑照片卡片上，替代原大照片区域。
12. 饮食主页面底部重复的“今日摄入统计”删除。
13. 日历日期详情复用 `TodayMoodCard / TodaySleepCard / TodayActivityCard`，只将其切换为历史只读模式。
14. 小窝卡片放大入口图形，保留标题、说明和右向宽箭头，删除“打开”。
15. 小窝新增共享纪念日卡片，双方都可编辑。
16. 体重表单删除备注输入，改为日期 + 精确时间 + 体重；旧 note 字段只为兼容历史数据保留。
17. 同一天多次体重全部保留；趋势图按 `measurementDate` 分组求日平均。
18. 趋势切换为 `周 / 月 / 季度 / 年`，默认月。
19. 增加年份导航和宽箭头；周/月/季度使用所选年份中与当前日期对应的周、月、季度，年模式显示全年。
20. 体重顶部显示当前体重、相对上一条实际记录的变化、目标体重；目标体重沿用 R8 actor-only `target_weight_kg`。
21. 小信箱增加所有/信纸/明信片筛选，信纸标题、4 套纸张主题；明信片无标题。
22. 信箱列表固定等高：信纸展示标题 + 摘要，明信片展示首句话；点开阅读完整正文。
23. 家庭药箱改为单一紧凑列表，行内突出数量、状态、最终失效日和剩余/过期天数。

## 视觉实施

继续以：

- `app/island-life-tokens.css` 作为 token 源；
- `app/island-life-refactor.css` 作为 R4-R6 页面 visual adapter；
- 新增 `app/r8-ui-closeout.css` 作为 R8.1 最后一层页面覆盖。

这样避免为了局部验收重写旧 CSS，同时让后续可以针对设计稿单独微调 R8.1 差异。

## 数据边界

### 共享

- 纪念日：Cat/Fish 均可修改同一条共享配置；
- 活动：继续沿用现有共同活动语义；
- 药箱：共同维护。

### 个人

- 心情/睡眠/体重：只有“我”可改，Ta 只读；
- 目标体重：仍然是当前 actor 只能改自己的；
- 信件：只允许寄件人编辑/删除自己的信。

## 无需新增数据库字段

本轮复用已经存在的：

- `app_configs.anniversary_date`
- `partner_profiles.target_weight_kg`
- `weight_measurements.measured_at`
- `activity_entries.activity_type`
- `mailbox_letters.title`
- `mailbox_letters.theme_key`

所以 R8.1 不新增 Production migration，避免无意义 schema 漂移。

## 回归测试

新增 `tests/life/r8-ui-closeout.test.ts`，把以下 UX 写成源码级回归约束：

- anniversary/day count；
- 编辑文案；
- 8h 满环；
- activity add/edit/icon；
- food compact photo/no duplicate summary；
- calendar home-card reuse；
- nest chevrons/no “打开”；
- exact weight time/daily averages/period/year/target；
- mailbox title/theme/filter/fixed preview/reader；
- compact medicine list。

并同步更新旧 R1-R6 测试中已经被 R8.1 正式替换的文案断言。

第一轮 CI 暴露两个兼容问题：

- 旧 mailbox 测试仍断言 `全部信件 / life-letter-date`；
- `TodayActivityCard` 中同步 props 到本地 state 的 effect 触发 `react-hooks/set-state-in-effect`。

两项都已修复。最终 CI #248：

```text
Test   ✅
Lint   ✅
Build  ✅
```

## 最终合并状态

PR：

```text
#47 R8.1: close remaining Island Life UI gaps
```

已 squash 合并到 `main`：

```text
52aebad2c28560958d055b06522b8b95b82eda39
```

`vercel.json` 合并后仍为：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

因此本次 Git 合并没有授权或触发新的 Vercel Preview/Production。

## 完成定义

R8.1 开发阶段已经全部满足：

1. 23 项全部在代码中落实 ✅
2. Test / Lint / Build 全绿 ✅
3. 文档更新 ✅
4. PR 合并 main ✅
5. 不自动部署 ✅
6. 等用户下一次明确允许 Production 部署后，再做真实移动端截图验收与像素级微调 ⏳
