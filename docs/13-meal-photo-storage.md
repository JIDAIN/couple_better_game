# 餐食照片存储与显示边界

状态：R11.5（2026-09-06）

详细实现与发布记录见 `docs/45-r11-5-meal-nutrition-photo-display.md`。

## 1. 当前模型

每个正式 meal 当前只绑定 **1 张展示照片**：

```text
public.meals.photo_path
public.meals.photo_rotation_degrees
public.meals.photo_scale
```

含义：

- `photo_path`：Supabase Storage 中的压缩展示图对象路径；
- `photo_rotation_degrees`：无损显示旋转，`0 / 90 / 180 / 270`；
- `photo_scale`：无损显示缩放，`0.60 .. 1.00`。

旋转与缩放只是展示元数据，不反复重写图片像素。

## 2. 上传与压缩

浏览器与 AI 媒体最终都进入服务端压缩边界：

```text
原图
→ EXIF 方向归一
→ 最长边 600px
→ WebP quality 70
→ >120KB 时逐步降到 65 / 60 / 55
→ Private Supabase Storage: meal-photos
→ meals.photo_path
```

普通网页上传单文件上限仍为 10MB；受信任的 Drive 原图通道可有不同入口上限，但最终展示图仍走相同压缩逻辑。

支持 MIME：JPEG / PNG / WebP / HEIC / HEIF。

Storage path：

```text
<space-slug>/<meal-id>/<random>.webp
```

## 3. 默认方向

压缩后的最终像素尺寸用于生成默认显示方向：

```text
height > width  -> photo_rotation_degrees = 90
否则            -> photo_rotation_degrees = 0
photo_scale      -> 1.00
```

所以手机竖拍的餐食照片默认会在饮食卡片里横向显示。

用户之后可以在程序 UI 中改回竖向或旋转 180°/270°，不会重新压缩原图。

## 4. UI 显示规则

真实餐食照片统一通过 `MealPhotoFrame` 展示：

- 固定卡片视觉框为 4:3；
- 主图使用 `object-contain`；
- 禁止对真实餐食照片使用 `object-cover` 强裁切；
- 用户选择竖图时，空余区域使用浅色 / 空白背景填充；
- 两边或上下出现留白是预期行为，优先保证整张照片完整；
- 编辑页支持左转 / 右转 90°；
- 编辑页支持 60%–100% 显示大小调节。

## 5. Photo API

### GET

```text
GET /api/meals/:id/photo
```

鉴权后返回私有 Storage 中的展示图。

### PUT

```text
PUT /api/meals/:id/photo
```

流程：

```text
校验
→ 压缩
→ 上传新对象
→ 计算默认旋转
→ replace_meal_photo_state
→ best-effort 清理旧对象
```

数据库替换失败时删除刚上传的新对象，避免孤儿文件。

### PATCH

```text
PATCH /api/meals/:id/photo
```

只修改：

```text
rotationDegrees
scale
```

不重新编码 Storage 图片。

### DELETE

```text
DELETE /api/meals/:id/photo
```

解绑 / 删除照片后同时恢复：

```text
rotation = 0
scale = 1
```

## 6. AI 多图边界

用户可以在聊天里发送餐前图、餐后图等多张图片用于实际摄入分析，但当前正式 meal 仍只持久化 1 张展示图。

行为约定：

- 多张图片都可参与 AI 差分分析；
- 未特别指定时，正式保存餐前图；
- 餐后图默认只用于判断剩余量；
- 用户明确要求保存餐后图时，保存餐后图；
- 当前不能声称同一 meal 已永久保存两张照片；
- 不创建不存在的 `beforePhotoPath` / `afterPhotoPath` 字段。

如果未来需要永久保存餐前 + 餐后多图，应新增独立 `meal_media`/附件模型，而不是继续扩张单个 `photo_path`。

## 7. AI 媒体恢复

如果 MCP / 客户端没有透传真实图片字节，但用户要求保存图片：

```text
life_mutate attachPhoto=true
→ MEDIA_ATTACHMENT_REQUIRED
→ recovery.uploadUrl
→ 用户浏览器补传同一张图
→ 服务端完成压缩与正式绑定
```

收到 `MEDIA_ATTACHMENT_REQUIRED` 后不得重复 create/update 造成双写。

## 8. 安全约束

- `meal-photos` bucket 为 private；
- 浏览器不持有 Supabase service secret；
- Storage 不开放任意浏览器写策略；
- GET/PUT/PATCH/DELETE photo API 均走现有身份/权限边界；
- 文件名与对象路径由服务端生成；
- 普通 Meal CRUD 不允许客户端直接编辑 `photo_path`；
- 显示旋转只允许 `0/90/180/270`；
- 显示 scale 只允许 `0.60..1.00`。
