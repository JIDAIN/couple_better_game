# 餐食照片存储边界

状态：V2-P3C（2026-09-02）

## 目标

饮食页允许每餐上传一张实物照片；如果没有上传，页面始终使用项目内置的原创卡通餐食插图，不显示空白框。

## 数据流

```text
Browser
  ↓ same-origin + HttpOnly cloud session
Next.js /api/meals/:id/photo
  ↓ server-only Supabase secret
Private Supabase Storage bucket: meal-photos
  ↓
public.meals.photo_path
```

浏览器不获取 Supabase secret，也不直接获得 Storage 写权限。`photo_path` 只是服务端使用的对象路径，不作为用户可编辑字段进入 `MealWritePayload`。

## Storage

- bucket: `meal-photos`
- public: `false`
- 单文件上限：10 MB
- MIME：JPEG / PNG / WebP / HEIC / HEIF
- path：`<space-slug>/<meal-id>/<random>.<ext>`

上传新照片时先写入新对象，再原子替换 `photo_path`；数据库替换失败时删除新对象。替换成功后旧对象做 best-effort 清理。删除餐食时也做照片对象清理。

## UI

饮食页：

```text
有 photo_path -> /api/meals/:id/photo -> 实物照片
无 photo_path -> public/illustrations/meals/*.svg -> 默认卡通图
```

编辑一餐支持上传、更换和移除照片。移除照片后不是空白，而是恢复对应餐次的默认卡通图。

## 安全约束

- Storage bucket 不公开；
- Storage 不创建浏览器直连策略；
- GET/PUT/DELETE photo API 都复用现有 cloud-session 鉴权；
- 只接受图片 MIME，并同时在 API 与 bucket 层限制文件大小；
- 文件名由服务端生成，不使用用户原始文件名；
- Meal 普通 CRUD 不允许客户端任意指定 `photo_path`。
