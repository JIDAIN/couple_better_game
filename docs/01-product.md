# 产品与功能

状态：2026-09-06 / R11.5。

## 1. 产品定位

Couple Better Game 是两个人共同使用的私人生活记录与成长应用。

当前产品同时包含：

1. **生活记录**：今日、饮食、心情、睡眠、活动、体重、药箱、小信箱、日历等；
2. **Legacy Game**：deficit、运动奖励、金币/宝石、兑换和成长地图；
3. **AI 接入**：Harbor ChatGPT Project、MCP 和程序内置 AI 都通过同一个 AI Access Core 读写正式生活数据。

生活事实与游戏事实可以按日期关联展示，但不能互相自动覆盖。

## 2. 固定角色

```text
cat  = 猫猫
fish = 鱼鱼
```

Harbor Cat 中：

```text
我 = cat
Ta / 对象 = fish
团子 = AI 昵称，不是身份凭证
```

身份权限由服务端授权上下文决定，不由自然语言猜测。

## 3. 当前生活主功能

主生活区域包括：

```text
今日
饮食
日历
小窝
我的 / 设置
```

小窝继续承载体重、小信箱、家庭药箱、游戏机等入口。

Legacy Game 独立保留，不要求为了生活页改造而重写旧游戏规则。

## 4. 饮食记录

饮食是独立事实域：

```text
meals
meal_items
```

支持：

- breakfast / lunch / dinner / snack / other；
- snack 时段；
- 吃饭时间；
- 食物名称与份量描述；
- estimated weight；
- calories / calorie range；
- protein / carbs / fat；
- 单餐总热量；
- 手动新增 / 编辑 / 删除；
- 私有餐食照片；
- AI 正式写入；
- source = manual / chatgpt / import；
- 幂等写入与读回确认。

Meal calories / macros 允许未知：

```text
NULL = 未估算
0    = 确实为 0
```

## 5. AI 记录一顿饭

新的 meal 默认采用：

```text
用户发文字 / 图片
→ 团子分析实际吃下去的量
→ 给出待确认营养草稿
→ 用户修改或确认
→ 正式写入程序
```

第一句“帮我记录 / 记一下 / 保存”表示用户最终想记录，不等于已经确认 AI 的估算结果。

草稿只存在聊天上下文，不保存到后台，也没有 `meal_drafts` 数据表。

AI Access Core 不再通过“当前消息是否包含确认关键词”硬拦截 meal create。

## 6. 实际摄入

营养记录统计实际吃下去的量。

优先级：

```text
用户文字
>
餐前 / 餐后照片差分
>
单张照片合理估算
```

例如“这个没吃”“只吃一半”“后来又添了几口”都必须优先覆盖纯视觉估计。

餐前 + 餐后：

```text
实际摄入 = 餐前估计量 - 餐后剩余可食量
```

## 7. AI 营养草稿

能合理判断时，默认草稿尽量包含每种食物的：

- 名称；
- 实际份量；
- estimated weight；
- calories；
- protein；
- carbs；
- fat。

整顿饭尽量给出总热量与总 macros。

这是合理估算，不是假装精确测量。明显不确定项应说明；真正不知道的字段允许留空 / null。

用户确认后应尽量一次完成正式 meal 写入，不把“名字、热量、宏量营养”拆成多次补写。

## 8. 餐食照片

正式 meal 当前只绑定 1 张展示照片。

### 多图使用

用户可以发餐前、餐后等多张图用于 AI 分析。

默认：

```text
所有相关图片参与分析
→ 正式 meal 默认保存餐前图
→ 餐后图默认只用于差分
```

如果用户明确要求保存餐后图，则保存餐后图。

如果用户要求两张都永久保存，当前产品应明确说明只支持一张正式展示图，不能假装两张都已持久化。

### 默认方向

竖拍照片上传后默认按横向餐卡显示：

```text
portrait -> display rotation 90°
landscape -> 0°
```

用户可以在编辑页：

- 左转 / 右转 90°；
- 调整显示大小 60%–100%；
- 更换照片；
- 移除照片。

真实照片始终优先完整显示。用户改为竖向时采用留白填充，不强裁切两边内容。

## 9. 手动编辑 AI 餐食

用户打开 AI 已写入的 meal 并手动编辑时：

- 无关修改不能清空 AI 已有营养估算；
- estimated weight / macros / calorie range 应正常 round-trip；
- 只有用户实际修改会影响估算的食物信息时，相关旧估算才应失效或重算。

## 10. 与 Legacy Game 的边界

```text
intake ≠ deficit ≠ weight ≠ exercise
```

因此：

- meal calories 不自动修改 deficit；
- meal 不自动触发金币 / 宝石；
- meal 不自动修改 heatmap；
- 真实体重写 `weight_measurements`，不覆盖旧游戏体重快照。

## 11. AI 入口

当前产品支持同一个 AI Access Core 的多个入口：

```text
Harbor ChatGPT Project
MCP
程序内置 AI
```

它们共享权限和正式数据层；未来新增例如生理期 `cycle` 模块时，应扩展 domain adapter，而不是重新设计每个 AI 客户端。

## 12. 当前产品边界

当前仍明确不做：

- 医疗诊断；
- 营养精确测量声明；
- AI 任意 SQL；
- 未授权跨身份个人写入；
- 餐前 + 餐后两张照片同时永久绑定到一个 meal；
- meal 自动驱动游戏 deficit / 奖励。
