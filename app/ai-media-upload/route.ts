import { compressMealPhoto, MEAL_PHOTO_MAX_INPUT_BYTES } from "@/lib/server/image-compression";
import { executeLifeAgentTool, type LifeAgentAttachment } from "@/lib/server/life-agent-executor";
import { resolveLifeMediaRecovery } from "@/lib/server/life-mcp-media-recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#aedcc8"><title>${escapeHtml(title)}</title><style>body{margin:0;background:#f8efe9;color:#302722;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{max-width:520px;margin:0 auto;padding:28px 20px 48px}.card{background:#fffaf6;border:1px solid #eadbd0;border-radius:24px;padding:22px;box-shadow:0 10px 30px rgba(88,63,48,.08)}h1{font-size:24px;margin:0 0 12px}p{line-height:1.7;color:#65564d}.upload{display:grid;gap:14px;margin-top:20px}input[type=file]{width:100%;box-sizing:border-box;padding:14px;background:#fff;border:1px solid #d9c5b8;border-radius:16px}button{border:0;border-radius:999px;padding:14px 20px;background:#9b5132;color:#fff;font-size:16px;font-weight:700}small{display:block;margin-top:12px;color:#8b786c}.ok{font-size:46px}.error{color:#a0392e;font-weight:700}</style></head><body><main class="shell"><section class="card">${body}</section></main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

function readToken(url: string) {
  return new URL(url).searchParams.get("token")?.trim() ?? "";
}

export async function GET(request: Request) {
  const token = readToken(request.url);
  const payload = token ? resolveLifeMediaRecovery(token) : null;
  if (!payload) {
    return page(
      "上传链接已失效",
      `<h1>上传链接已失效</h1><p class="error">这个链接无效或已经超过 10 分钟。请返回 AI 对话，重新发起一次需要保存图片的饮食记录。</p>`,
      400,
    );
  }

  return page(
    "补传饮食照片",
    `<h1>补传这张饮食照片</h1><p>当前聊天客户端没有把原图直接交给 MCP。你可以在这里选择同一张照片；上传成功后，系统会用刚才那次 AI 操作的身份和内容继续完成记录。</p><form class="upload" method="post" enctype="multipart/form-data"><input type="hidden" name="token" value="${escapeHtml(token)}"><input type="file" name="image" accept="image/*" required><button type="submit">上传并完成记录</button></form><small>链接约 10 分钟后失效。只接受图片，仍会按饮食图片规则自动压缩后保存。</small>`,
  );
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return page("上传失败", `<h1>上传失败</h1><p class="error">没有收到有效的表单数据。</p>`, 400);
  }

  const token = typeof form.get("token") === "string" ? String(form.get("token")).trim() : "";
  const payload = token ? resolveLifeMediaRecovery(token) : null;
  if (!payload) {
    return page("上传链接已失效", `<h1>上传链接已失效</h1><p class="error">请返回 AI 对话重新发起图片记录。</p>`, 400);
  }

  const image = form.get("image");
  if (!(image instanceof File) || image.size <= 0) {
    return page("请选择图片", `<h1>请选择图片</h1><p class="error">没有收到图片文件。</p>`, 400);
  }
  if (!image.type.toLowerCase().startsWith("image/")) {
    return page("文件类型不支持", `<h1>文件类型不支持</h1><p class="error">这里只接受图片文件。</p>`, 415);
  }
  if (image.size > MEAL_PHOTO_MAX_INPUT_BYTES) {
    return page("图片过大", `<h1>图片过大</h1><p class="error">请选择体积更小的原图后重试。</p>`, 413);
  }

  try {
    const source = Buffer.from(await image.arrayBuffer());
    const compressed = await compressMealPhoto(source, image.type);
    const attachment: LifeAgentAttachment = {
      bytes: compressed.bytes,
      contentType: "image/webp",
      extension: "webp",
      width: compressed.width,
      height: compressed.height,
      outputBytes: compressed.outputBytes,
    };
    const identity = {
      partnerKey: payload.partnerKey,
      displayName: payload.partnerKey === "cat" ? "猫猫" : "鱼鱼",
    } as const;
    const result = await executeLifeAgentTool("life_mutate", payload.args, {
      identity,
      latestUserText: payload.userText,
      attachment,
      toolCallId: payload.operationId,
    });

    return page(
      "照片已保存",
      `<div class="ok">✅</div><h1>照片和饮食记录已处理</h1><p>这张原图已经经过压缩并交给正式生活记录服务处理。你现在可以返回 RikkaHub 继续聊天。</p><small>操作结果：${escapeHtml(JSON.stringify(result))}</small>`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return page(
      "保存失败",
      `<h1>保存失败</h1><p class="error">${escapeHtml(message)}</p><p>没有把失败结果伪装成成功。你可以返回 AI 对话重新确认记录内容。</p>`,
      500,
    );
  }
}
