# 产品与功能

## 1. 产品定位

「🐟和🐱变美变瘦大作战」是一个两个人共同使用的轻量健康习惯养成工具。

产品同时包含两条线：

1. **游戏化坚持**：记录游戏 `deficit`、运动和体重快照，获得金币/宝石，查看成长地图并兑换奖励。
2. **真实健康记录**：记录实际饮食，并逐步加入真实体重趋势和完整每日总览。

两条线可以在“同一天”一起看，但不能混成同一个数据字段。

## 2. 两个固定角色

- `fish`：鱼鱼
- `cat`：猫猫

当前 ChatGPT 饮食聊天约定：

```text
用户自己的饮食聊天 -> cat（猫猫）
鱼鱼的饮食聊天     -> fish（鱼鱼）
```

上下文不明确时不得猜角色后写入；用户明确说明角色时，以当前明确说明优先。

## 3. 当前页面

主导航固定为：

```text
今日 / 地图 / 兑换 / 小窝
```

### 今日 `#today`

当前包含：

- 今日成长资源概览；
- 双方游戏体重快照 / deficit / 运动录入；
- 游戏结算预览和保存；
- 「饮食小记」：按日期和角色查看实际饮食；
- 手动新增 / 编辑 / 删除餐食；
- **“当天合在一起看”**：同一角色同一天展示实际摄入、游戏热量缺口、运动和体重快照。

饮食功能仍属于原有 notice-board，不新增第五个主 Tab。

### 地图 `#map`

- 双人月度成长热力图；
- 周六到周五完整周；
- 跨月真实记录可见但弱化。

### 兑换 `#shop`

- 奖励分类；
- 金币 / 宝石兑换；
- 兑换历史维护。

### 小窝 `#nest`

- 最近记录；
- 规则说明；
- 数据管理；
- 成长日志。

## 4. 核心用户流程

### 4.1 每日游戏打卡

```text
打开今日页
-> 输入鱼鱼 / 猫猫游戏数据
-> 前端规则层生成奖励预览
-> 确认保存
-> AppDataStore / localStorage
-> 派生钱包、周统计、热力图
-> 后续同步到 Supabase
```

当前游戏最终结算仍由前端 `lib/home` service/rules 完成，服务端尚未独立重算整套奖励。

### 4.2 手动记录饮食

```text
今日 -> 饮食小记
-> 选日期 / 角色
-> 记一餐
-> 填餐型、食物、份量、kcal、可选上下限
-> Next.js Meal API
-> Supabase meals + meal_items
```

新增一餐不会自动修改 `deficit`、金币、宝石或 heatmap。

### 4.3 ChatGPT “记上”

```text
发食物图片 / 描述
-> ChatGPT 估算
-> 用户修正
-> 仍不写数据库
-> 用户明确“记上”
-> create_chatgpt_meal_record
-> meals + meal_items
-> get_chatgpt_meal_record 读回确认
-> 成功后回复“已记上”
```

规则：

- 未明确确认不写；
- 一次确认一个 `chatgpt:` 幂等键；
- 同 key 重试，不换 key 盲写；
- `source=chatgpt`、`status=confirmed`；
- 至少一个食物 item；
- 不自动改游戏 deficit / 运动 / 体重 / 钱包 / heatmap。

### 4.4 同日关联（P2.5 已上线）

饮食和游戏记录继续是不同事实域，但现在产品层按：

```text
partnerKey + date
```

放在一起展示。

页面会同时给出：

- 当天餐数；
- 当天总摄入 kcal；
- 所有餐都有区间时，显示当天总摄入区间；
- 游戏热量缺口；
- 当天运动分钟；
- 游戏体重快照。

缺失行为：

- 有 meals、无 daily record → “当天游戏记录未填写”；
- 有 daily record、无 meals → 实际摄入显示“未记录”；
- Meal API 失败 → 显示“暂未加载”，不误显示 0 kcal。

这只是**关联展示**，不会自动让 intake 与 deficit 相互覆盖。

### 4.5 历史游戏记录

```text
成长日志
-> 选日期
-> 补录 / 编辑原始输入
-> service 重建该日结果
-> 重算派生状态
-> 保存并同步
```

### 4.6 新设备首次使用

```text
小窝 -> 数据管理
-> 输入同步密码
-> 建立 HttpOnly cloud session
-> 先下载 Supabase 当前游戏快照
-> 再允许后续写回
```

首次设备不能直接用空本地状态覆盖云端。

## 5. 四个健康数据域

### Intake

真相源：`meals / meal_items`。

记录实际吃了什么、份量、估算 kcal、上下限、可选 macros。

### Deficit

真相源：`daily_record_sides.deficit_kcal` / `DailyRecordSide.deficit`。

它是现有游戏字段，不等于 meals 总摄入。

### Weight

- `weight_measurements`：真实体重趋势真相源；
- `daily_record_sides.weight_kg`：游戏某日快照。

### Exercise

当前以 `daily_record_sides.exercise_minutes` 参与游戏规则。

核心关系：

```text
intake ≠ deficit ≠ weight ≠ exercise
```

展示时按 `partnerKey + date` 关联。

## 6. 饮食功能状态

已支持：

- breakfast / lunch / dinner / snack / other；
- snack 时段；
- eaten_at；
- 单餐和单品 kcal / 上下限；
- optional macros 展示；
- source = manual / chatgpt / import；
- idempotency key；
- CRUD + 软删除；
- 日期 + fish/cat 查询；
- 当天餐数和 kcal 合计；
- 食物明细展开；
- Web 手动新增 / 编辑 / 删除；
- ChatGPT 明确确认后写入；
- ChatGPT 幂等重试和读回确认；
- 同日游戏快照关联展示。

下一阶段是 **P3 体重趋势**。

## 7. UI 视觉边界

饮食和同日关联都继续位于：

```text
notice-board
└─ AppSectionPanel「饮食小记」
   ├─ 日期 / 角色
   ├─ 当天合在一起看 AppCard
   ├─ 餐食列表 AppCard
   └─ AppModal 新增 / 编辑 / 删除
```

继续复用 `AppButton / AppCard / AppInput / AppModal / AppRoleAvatar` 和 animal-island-ui `Title`，不建立第二套视觉 primitive。

## 8. 当前产品边界

目前仍没有：

- 完整用户账号 / membership；
- 实时协同编辑；
- 自动冲突合并；
- 服务端独立重算所有游戏奖励；
- ChatGPT 自动保存未确认饮食；
- ChatGPT 专用已保存餐食更新 / 删除 RPC；
- 真实体重趋势 UI；
- 医疗或营养诊断功能。
