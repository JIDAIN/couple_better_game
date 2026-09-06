# R11.4 MCP Media Adapter

日期：2026-09-06

## 背景

R11 Production 在 RikkaHub + DeepSeek 实测中，文字 meal 写入正常，但聊天中上传的饮食图片出现两个问题：

1. 模型无法真正识别食物照片，只拿到 `[Image]` / `<image_file_ocr>` 一类占位或 OCR 文本；
2. `life_mutate` 无法把当前聊天原图绑定到 meal，最终只能保存文字记录。

这不是 Supabase Storage 或 meal 图片压缩链本身失效。现有 ChatGPT/OpenAI 文件路径仍依赖 MCP tool `_meta["openai/fileParams"]` 自动把 `file={download_url,file_id,...}` 绑定进工具调用。

## RikkaHub 实际行为核验

RikkaHub 当前 MCP 调用实现中，`callTool` 只把模型生成的 `JsonObject args` 传给 MCP SDK：

```text
CallToolRequestParams(name = toolName, arguments = args)
```

当前实现没有看到把聊天消息中的 `UIMessagePart.Image` 自动转换为 MCP tool argument 的逻辑。

当当前聊天模型本身不支持 IMAGE modality 时，RikkaHub 的 `OcrTransformer` 会：

1. 找到本地 `file:` 图片；
2. 单独调用配置的 OCR 模型；
3. 把图片替换成：
   `<image_file_ocr>...</image_file_ocr>` 文本；
4. 再把文本交给聊天模型。

因此：

- 如果 OCR 模型本身不能真正看图，聊天模型只会得到 `[Image]` / OCR failure；
- 即使 OCR 模型能描述照片，也只是解决“识别”，不会把原始图片字节交给 MCP tool；
- 所以 RikkaHub 当前版本无法仅靠 MCP server 自动取得手机本地聊天图片原图。

## R11.4 服务端改动

### 1. 保留 ChatGPT/OpenAI file path

继续支持：

```json
{
  "file": {
    "download_url": "...",
    "file_id": "...",
    "mime_type": "image/jpeg"
  }
}
```

并继续通过现有压缩边界：最长边 600px、WebP、质量策略、Storage 绑定。

### 2. 新增 client-neutral inline media

`life_mutate` 新增：

```json
{
  "media": {
    "data_base64": "...",
    "mime_type": "image/jpeg",
    "file_name": "meal.jpg"
  }
}
```

适用于未来能够把聊天附件字节传给 MCP tool 的客户端，而不依赖 OpenAI 专有 `fileParams`。

安全限制：

- 只接受 `image/*`；
- base64 必须合法；
- 解码后继续受 `MEAL_PHOTO_MAX_INPUT_BYTES` 限制；
- 不新增任意 `imageUrl/fileUrl` 下载，避免把 MCP server 变成 SSRF fetcher；
- `file` 与 `media` 同时出现直接拒绝。

### 3. 禁止“图片其实没上传但报告成功”

如果模型传：

```json
{ "attachPhoto": true }
```

但本次 MCP call 实际没有 `file` 或 `media` 字节，服务端返回：

```text
MEDIA_ATTACHMENT_REQUIRED
```

明确要求客户端不要把本次操作报告成“图片已保存”。

这样 RikkaHub 当前环境下不会再静默降级为“文字保存成功，然后模型让用户误以为图片也绑定了”。

## RikkaHub 当前兼容边界

R11.4 服务端可以让 MCP media contract 不再只绑定 OpenAI，但不能凭空读取 Android App 的本地 `file:` URI。

要让 RikkaHub 真正完成：

```text
聊天图片 -> MCP -> Supabase Storage
```

客户端至少需要未来提供以下任意一种能力：

- 将聊天附件字节编码到 `media.data_base64`；
- 将附件上传到安全文件服务并生成可验证 file reference；
- MCP SDK/客户端原生支持 attachment/resource binding 到 tool arguments。

在此之前，RikkaHub 可以通过“使用真正支持图片输入的 OCR/视觉模型”改善食物识别，但原图 Storage 绑定仍然受客户端限制。

## 验收计划

代码侧：

- OpenAI file path 回归；
- inline image schema；
- MIME/base64/大小限制；
- 双 media source 拒绝；
- `attachPhoto=true` 无附件时显式失败；
- Test / Lint / Build。

Production：本轮代码完成后仍需单独取得 Production 部署授权，再做真实 MCP 回归。
