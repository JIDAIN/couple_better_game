# R11.5 — 饮食营养完整化与照片显示编辑

## 目标

这一轮解决两个独立但都发生在饮食模块的问题：

1. AI 记录餐食时不能只保存食物名称或把热量写在自然语言里，而应在能合理判断时一次性提交正式营养字段。
2. 餐食照片默认以横向卡片方式显示，同时允许用户在 UI 中无损旋转和缩放；用户选择竖向显示时不得裁掉照片两侧内容。

## AI 饮食写入规则

新的 meal 继续采用“先草稿、后确认、再写入”的交互规则，但确认状态属于聊天上下文，而不是数据库状态，也不再依赖服务端匹配“确认/可以/好的”等关键词。

当用户要记录一顿饭时，AI 应综合：

- 用户文字；
- 当前可见的食物图片；
- “吃了一半 / 几口 / 基本吃完 / 没吃某样 / 两个人分着吃”等实际摄入信息；
- 合理的常见份量与营养知识。

能合理判断时，一次性填写：

- `rawName` / `displayName`
- `portionDescription`
- `estimatedWeightG`
- `caloriesKcal`
- `proteinG`
- `carbsG`
- `fatG`
- `totalCaloriesKcal`

估算针对实际吃下去的量，不是最初摆盘量。用户明确文字优先于图片。允许合理估算，但不能伪装成精确测量；真正无法判断的字段仍允许为 `null`，canonical meal schema 不做“所有营养字段必须非空”的硬校验。

ChatGPT Bridge 的系统提示通过 `MEAL_DRAFT_AGENT_RULES` 获得完整化规则；MCP 客户端通过 `life_mutate` 的 tool description 获得同样的默认营养完整化约束。因此规则不再只依赖某一个客户端的提示词。

## 照片方向与缩放

数据库新增：

- `photo_rotation_degrees`: `0 | 90 | 180 | 270`
- `photo_scale`: `0.60 .. 1.00`

这两个字段只描述显示方式，不改写原图像素。

上传链路仍先执行 EXIF 方向归一与既有 WebP 压缩。压缩后服务端根据最终宽高设置默认显示：

- `height > width`：默认 `90°`，在饮食卡片中横向显示；
- 其他情况：默认 `0°`；
- 默认缩放 `100%`。

浏览器上传、ChatGPT/MCP 直接附件和图片恢复链路最终都复用同一套服务端照片状态写入逻辑。

## UI 行为

`MealPhotoFrame` 是饮食首页和餐食编辑页共用的显示组件。

- 固定卡片框为 `4:3`；
- 主图始终使用 `object-contain`；
- 旋转和缩放由 CSS transform 实现；
- 空余区域使用页面原有的浅色背景填充；
- 不使用 `object-cover` 对真实餐食照片做强制裁切；
- 用户可左转 / 右转 90°；
- 用户可在 60%–100% 范围内调节显示大小；
- 修改显示设置只更新元数据，不重新压缩图片。

因此，用户把照片设回竖向时，会看到完整竖图及两侧留白，而不是为了铺满横向卡片裁掉上下或左右内容。

## API

`PUT /api/meals/:id/photo`

- 压缩并保存新照片；
- 根据图片最终宽高写入默认显示方向；
- 原子替换照片路径与显示元数据。

`PATCH /api/meals/:id/photo`

- 只修改旋转角度和显示大小；
- 不重写 Storage 中的图片对象。

`DELETE /api/meals/:id/photo`

- 删除照片；
- 同时恢复 `rotation=0`、`scale=1`。

## 数据库迁移

迁移文件：

`supabase/migrations/20260906160000_add_meal_photo_display_transform.sql`

迁移新增两个字段、约束，并提供：

- `replace_meal_photo_state`
- `update_meal_photo_display`

旧的 meal 数据默认得到 `0° / 100%`；历史照片不会因为迁移而重新编码。

## 回归测试

覆盖：

- EXIF 方向归一；
- 竖图上传默认 90°；
- 旋转角度和缩放范围校验；
- UI 使用 contain + 留白，不回退到真实照片 `object-cover`；
- 编辑页旋转与缩放控件；
- 服务端不再用关键词硬拦截 meal create；
- Bridge 仍保留“先草稿、后确认、再写入”的 agent 规则；
- MCP tool description 要求默认补全营养字段但允许真正未知值为 null；
- 原有媒体恢复与身份/幂等边界不变。

## 发布边界

合并代码与执行数据库 migration 不等于 Production 前端部署。仓库的 Vercel Git 自动部署仍保持关闭；只有获得明确的 Production 部署授权后，才执行一次受控 Production 部署。
