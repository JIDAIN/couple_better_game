# R11.5 — 饮食营养完整化与照片显示编辑

状态：2026-09-06 已合并、数据库迁移已执行、Production 已上线。

## 1. 目标

这一轮集中解决饮食记录的两个真实使用问题：

1. AI 记录餐食时不能只保存食物名称或只在自然语言里说热量，而应在能合理判断时一次性提交实际摄入量与完整营养字段。
2. 餐食照片需要默认以更适合饮食卡片的横向方式展示，同时允许用户在 UI 中无损旋转和缩放；用户选择竖向显示时不得为了铺满卡片裁掉图片内容。

## 2. AI 饮食草稿：只存在于聊天层

新的 meal 采用：

```text
分析
→ 待确认草稿
→ 用户修改 / 确认
→ 正式写入
```

这里的“草稿”和“确认状态”属于 AI 对话上下文，不属于数据库状态。

明确边界：

- 不新增 `meal_drafts` 表；
- 不保存 server-side draft state；
- `life-agent-executor` 不再通过“确认记录 / 可以 / 好的”等关键词硬拦截 meal create；
- AI / Project Instructions / tool description 负责遵守“先草稿、后确认、再写入”；
- 如果用户已经确认，正式写入因为 Bridge / 网络临时失败，用户随后说“再试一次”，AI 应从聊天上下文继续重试已确认的正式操作，不应要求再次确认。

因此 AI Access Core 只负责正式业务写入、安全、权限、字段校验、幂等和媒体处理，不承担跨轮确认状态机。

## 3. 实际摄入与餐前 / 餐后图片

饮食统计的是用户实际吃下去的量，不是餐前摆盘总量。

判断优先级：

```text
用户明确文字
>
餐前 / 餐后视觉差分
>
单张图片默认估算
```

例如：

- “鸡蛋没吃” → 不计入；
- “红薯吃了一半” → 只算一半；
- “米饭后来又添了半碗” → 追加实际摄入；
- 多人共享菜 → 只估当前用户的份额。

餐前 + 餐后两张图片时：

```text
实际摄入 = 餐前估计量 - 餐后剩余可食量
```

需要考虑食物移动、翻面、骨头 / 果皮 / 果核 / 虾壳 / 包装等不可食残余、汤汁酱料不确定性、餐后图不完整和中途添饭等情况。

## 4. 多图分析与正式照片保存边界

当前 meal media contract 正式只绑定 1 张展示照片。

因此：

- 餐前图、餐后图都可以参与 AI 的差分分析；
- 如果用户没有特别指定，正式 meal 默认保存餐前图；
- 餐后图默认只作为实际摄入估算依据；
- 如果用户明确说“保存餐后图”，则保存餐后图；
- 如果用户明确要求两张都永久保存，当前系统必须如实说明 meal 只能正式绑定一张，不得假装两张都保存成功；
- 不自行发明 `beforePhotoPath` / `afterPhotoPath` 等不存在的字段。

这一条属于 AI 行为约定和当前单图数据模型边界，不代表后台已经支持多图持久化。

## 5. AI 营养完整化

当用户确认后，AI 应尽量一次性提交：

- `rawName` / `displayName`
- `portionDescription`
- `estimatedWeightG`
- `caloriesKcal`
- `proteinG`
- `carbsG`
- `fatG`
- `totalCaloriesKcal`

估算必须针对实际摄入量。

允许合理估算，但不能伪装成精确测量。真正无法判断的字段仍允许为 `null`；canonical meal schema 不要求所有营养字段非空。

`NULL` 与 `0` 的语义必须保持不同：

```text
NULL = 未估算 / 不知道
0    = 确实为 0
```

ChatGPT Bridge 通过 `MEAL_DRAFT_AGENT_RULES` 获得这套行为约束；MCP `life_mutate` 的 tool description 也要求新 meal 在能判断时尽量一次补全营养字段。

## 6. 手动编辑不得吞掉 AI 营养数据

用户在程序 UI 中编辑已经由 AI 写入的 meal 时，不能因为只改了备注、时间、照片等无关字段，就把 AI 之前写入的营养信息清空。

编辑器现在会保留：

- `foodId`
- `displayName`
- `estimatedWeightG`
- `calorieMinKcal`
- `calorieMaxKcal`
- 已有宏量营养值
- meal-level calorie estimate

只有用户实际修改食物名称、份量、重量或热量等会影响估算的字段时，相关旧估算区间才应被重新计算或清空。

## 7. 照片压缩、方向与显示元数据

上传链路继续执行：

```text
EXIF 方向归一
→ 最长边 600px
→ WebP q70
→ >120KB 时 q65 → q60 → q55
```

数据库新增：

- `photo_rotation_degrees`: `0 | 90 | 180 | 270`
- `photo_scale`: `0.60 .. 1.00`

这两个字段只描述显示方式，不反复改写已经压缩好的图片像素。

压缩后服务端根据最终宽高设置默认显示：

- `height > width`：默认 `90°`，在饮食卡片中横向显示；
- 其他情况：默认 `0°`；
- 默认缩放 `100%`。

浏览器上传、AI/MCP 直接附件和 browser recovery 上传最终都复用同一套照片状态写入逻辑。

## 8. UI 行为

`MealPhotoFrame` 是饮食首页和餐食编辑页共用的真实照片展示组件。

规则：

- 卡片视觉框保持 `4:3`；
- 主图使用 `object-contain`；
- 不再用 `object-cover` 强制裁切真实餐食照片；
- 旋转和缩放由显示 transform 完成；
- 空余区域使用页面浅色 / 空白背景填充；
- 用户可左转 / 右转 90°；
- 用户可在 60%–100% 范围内调节显示大小；
- 修改旋转 / 大小只更新显示元数据，不重新压缩图片。

因此用户把照片设置为竖向显示时，会看到完整竖图和两侧留白，不会自动吞掉上下或左右内容。

## 9. Meal Photo API

`PUT /api/meals/:id/photo`

- 校验图片；
- EXIF 归一与压缩；
- 上传新对象；
- 根据最终宽高计算默认显示方向；
- 原子替换照片路径与显示元数据；
- best-effort 清理旧对象。

`PATCH /api/meals/:id/photo`

- 只修改 `rotationDegrees` 和 `scale`；
- 不改写 Storage 中的图片对象。

`DELETE /api/meals/:id/photo`

- 删除 / 解绑照片；
- 同时恢复 `rotation=0`、`scale=1`。

## 10. 数据库迁移

迁移文件：

`supabase/migrations/20260906160000_add_meal_photo_display_transform.sql`

已在 Production Supabase 执行成功。

新增：

- `meals.photo_rotation_degrees`
- `meals.photo_scale`
- 对应 check constraints
- `replace_meal_photo_state`
- `update_meal_photo_display`

历史 meal 默认得到 `0° / 100%`；历史照片不会因为迁移而重新编码。

## 11. 回归测试

当前覆盖：

- EXIF 方向归一；
- 竖图上传默认 90°；
- 旋转角度和缩放范围校验；
- UI 使用 contain + 留白；
- 编辑页旋转与缩放控件；
- 服务端不再用确认关键词硬拦截 meal create；
- Bridge 仍保留聊天层“先草稿、后确认、再写入”；
- MCP tool description 要求默认补全营养字段但允许未知为 null；
- UI 编辑 round-trip 不吞掉 AI 营养估算；
- 原有身份、权限、媒体恢复、幂等边界继续保留。

PR #84 最终合并 commit：

`1aa0dcad94674061f10d4735192383d01209d8c8`

## 12. Production 与部署纪律

R11.5 已于 2026-09-06 受控部署到 Production。

Production 自动部署在每次授权部署完成后都必须恢复为：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

一次“允许部署”只授权当前这一次 Production deployment；后续任何新的 Production deployment 仍需再次获得用户明确授权。
