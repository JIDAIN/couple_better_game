# AI Access Core 统一 Production 验收记录（2026-09-05）

> 状态：核心链路通过；发现 2 个需要继续硬化的边界。  
> Production：`couple-better-game.vercel.app`  
> 验收入口：Harbor Cat → COMMANDS → Apps Script Worker → Vercel AI Access Core → Supabase / Storage。

## 1. 验收原则

本轮不采用“让用户逐模块碰运气测试”的方式，而是统一覆盖：

- 自然语言字段 alias；
- 默认值；
- 缺失信息 clarification；
- query；
- create；
- delete；
- 图片原图 → 压缩 → Storage → 餐食绑定；
- 中文业务 label；
- 相对日期；
- 测试数据清理；
- Production runtime error。

真实业务数据仍以 Supabase / RECEIPT 为准，不以 AI 自述为准。

## 2. Production 实测通过

### 2.1 三餐自然字段归一化

输入使用中文 resource `三餐`，并故意使用 AI 常见自然字段：

- `items[].name`
- `items[].foodName`
- `quantity: "1个"`
- `amount: 1 + unit: "杯"`
- `mealType: "加餐"`

结果成功归一为 canonical meal：

- `mealType = snack`
- `rawName = AI验收苹果 / AI验收酸奶`
- `portionDescription = 1个 / 1杯`
- `partnerKey = cat`
- `source = chatgpt`

结论：之前 `name / foodName / rawName` 猜字段失败的问题已修复。

### 2.2 体重自然输入

输入：`weight = "63.21kg"`，未手工提供 `measurementDate / partnerKey`。

结果：

- `weightKg = 63.21`
- 日期自动使用 Asia/Shanghai 当天；
- 身份强制为 `cat`。

通过。

### 2.3 药箱自然输入与安全默认值

输入：

- resource 使用中文 `药品`；
- `medicineName = AI统一验收测试药品`；
- 未提供数量。

结果：

- `name` 正确归一；
- 新增数量自动默认为 `1`。

随后按关键词查询能命中该记录。

通过。

### 2.4 活动自然输入

输入：

- `name = AI统一验收散步`
- `person = 我们`
- `duration = 1小时30分钟`

结果：

- `text = AI统一验收散步`
- `participantScope = both`
- `durationMinutes = 90`

通过。

### 2.5 缺失关键信息 clarification

故意提交：

`帮我记一下体重`，不提供任何重量。

服务端没有暴露 `weightKg required` 等内部字段错误，而是正式 RECEIPT 返回：

`需要向用户确认：要记录多少公斤？`

通过。

### 2.6 查询 alias 与默认值

Production 实测以下查询均成功：

- `饮食 + 我` → meal / me / 今天；
- `药箱 + keyword` → medicine + name filter；
- `体重 + 我` → weight / me；
- `心情` → day / 今天；
- `信箱` → mailbox；
- `设置` → settings。

通过。

### 2.7 相对日期

请求参数没有提供 date，仅用户文本写“看看昨天的生活记录”。

结果自动解析到 `2026-09-04`。

通过。

### 2.8 moodLabel

查询正式返回：

- `moodKey = neutral`
- `moodLabel = 心动`

未再由 AI 自行把 `neutral` 翻译为“平静 / 一般”。

通过。

### 2.9 餐食照片完整链路

使用一张独立验收 JPEG 放入 Cat 的合法 Originals/Meals/Cat 目录，并通过 Harbor 使用：

- resource = `三餐`
- `attachPhoto = true`
- item 使用自然字段 `name / quantity`

完整链路成功：

`Drive trusted original`
→ `Harbor staging`
→ `image compression`
→ `WebP`
→ `Supabase Storage`
→ `meal.photoPath`
→ `RECEIPT`

正式 RECEIPT：

- `ok = TRUE`
- `photo_status = compressed_and_bound`
- Storage path 为 `.webp`
- 餐食正确绑定到 cat。

因此“中文三餐 alias + 照片”不会再在图片进入 Core 前被拒绝。

通过。

### 2.10 删除与测试数据清理

本轮临时创建的：

- 文字加餐；
- 照片加餐；
- 63.21kg 体重；
- AI统一验收测试药品；
- AI统一验收散步；

均使用明确删除意图和真实记录 ID 通过 Harbor 删除。

最终只读复核：

- meal 查询只剩用户原有的牛肉面 + 鸡蛋午餐；
- weight 查询只剩原有历史记录；
- medicine 关键词查询返回 `[]`；
- day 查询不再包含 AI统一验收散步。

验收用 Drive 原图也已删除。

数据库层清理通过。

### 2.11 Production 运行状态

验收完成后检查 Vercel 最近 30 分钟 Runtime Errors：

`No runtime errors found`。

同时仓库 `vercel.json` 已恢复：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

通过。

## 3. 本轮发现的两个遗留边界

### A. update 的“局部修改”仍需要继续硬化

目前 create / query / delete 和自然 clarification 已稳定。

但已有记录 update 仍主要依赖 AI：

1. 先查询原记录；
2. 找到真实 ID；
3. 把原字段与用户修改字段合并；
4. 再发送完整 canonical update payload。

例如用户只说：

`把这盒布洛芬数量改成 2`

理想目标应是 Core 自己读取旧记录并做 patch merge，而不是要求模型完整复述药品其余字段。

结论：功能可通过“query → merge → update”完成，但服务端 partial update hydration 尚未做到最终形态，需继续硬化。

### B. 删除带照片餐食后的 Storage 图片清理

实测照片餐食删除后：

- meal 已进入 deleted 状态，不再出现在正常 meal query；
- 但删除 RECEIPT 中仍保留旧 `photoPath`。

当前 `life-agent-registry` 的 meal delete 直接调用 `deleteMeal(id)`，没有同步调用 `deleteMealPhotoObject(photoPath)`。

这意味着可能产生 Supabase Storage orphan object。

目标修复：

`delete meal`
→ 获取已删除记录原 photoPath
→ best-effort 删除 Storage object
→ 将 cleanup 状态记录到结果 / 日志

该问题不影响用户页面正确隐藏已删除餐食，但长期会增加 Storage 垃圾，必须修。

## 4. CI 已覆盖但本轮未用真实用户数据破坏性复测的规则

以下规则已有自动化回归测试，本轮未为了 Production 验收故意破坏真实数据：

- cat / fish 个人记录身份强制；
- 非明确删除文本不能执行 delete；
- 不能修改 Ta 发出的信；
- `legacy_home` 全量覆盖必须包含精确确认短语；
- 图片目录身份边界；
- command / write 幂等保护。

这些继续作为 CI gate，不应为了“验收完整”在 Production 制造高风险操作。

## 5. 当前结论

当前 AI Access Core 已经达到：

- 自然新增：通过；
- 自然查询：通过；
- 缺信息自然追问：通过；
- 三餐字段兼容：通过；
- 图片上传、压缩、绑定：通过；
- 中文业务语义：通过；
- 明确 ID 删除与 ownership 规则：通过；
- 测试数据清理：通过；
- Production 稳定性：通过；
- 服务端 partial update 自动 merge：待硬化；
- 删除餐食后的 Storage object cleanup：待修复。

在这两个边界修复并重新通过 CI / 最小 Production 验收后，可将本轮状态升级为“统一验收完全通过”。
