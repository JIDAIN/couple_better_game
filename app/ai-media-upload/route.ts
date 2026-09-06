import { compressMealPhoto, MEAL_PHOTO_MAX_INPUT_BYTES } from "@/lib/server/image-compression";
import { executeLifeAgentTool, type LifeAgentAttachment } from "@/lib/server/life-agent-executor";
import { resolveLifeMediaRecovery } from "@/lib/server/life-mcp-media-recovery";
import { recognizeMealPhoto, type MealVisionItem } from "@/lib/server/life-meal-vision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

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
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#aedcc8"><title>${escapeHtml(title)}</title><style>body{margin:0;background:#f8efe9;color:#302722;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shell{max-width:520px;margin:0 auto;padding:28px 20px 48px}.card{background:#fffaf6;border:1px solid #eadbd0;border-radius:24px;padding:22px;box-shadow:0 10px 30px rgba(88,63,48,.08)}h1{font-size:24px;margin:0 0 12px}p{line-height:1.7;color:#65564d}.upload{display:grid;gap:14px;margin-top:20px}input[type=file]{width:100%;box-sizing:border-box;padding:14px;background:#fff;border:1px solid #d9c5b8;border-radius:16px}button{border:0;border-radius:999px;padding:14px 20px;background:#9b5132;color:#fff;font-size:16px;font-weight:700}small{display:block;margin-top:12px;color:#8b786c}.ok{font-size:46px}.error{color:#a0392e;font-weight:700}.items{margin:14px 0 0;padding:0;list-style:none;display:grid;gap:8px}.items li{padding:10px 12px;background:#f5ebe4;border-radius:12px}.muted{font-size:14px;color:#8b786c}</style></head><body><main class="shell"><section class="card">${body}</section></main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

function readToken(url: string) {
  return new URL(url).searchParams.get("token")?.trim() ?? "";
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function normalizeName(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "") : "";
}

function mergeVisionItems(args: JsonRecord, visionItems: MealVisionItem[]) {
  if (!visionItems.length) return args;
  const resource = String(args.resource ?? "").toLowerCase();
  if (resource !== "meal" && resource !== "三餐" && resource !== "饮食" && resource !== "餐食") return args;
  const data = asRecord(args.data);
  const current = Array.isArray(data.items) ? data.items.filter((item) => item && typeof item === "object") : [];
  const seen = new Set(current.map((item) => {
    const row = asRecord(item);
    return normalizeName(row.rawName ?? row.name ?? row.foodName);
  }).filter(Boolean));
  const additions = visionItems
    .filter((item) => !seen.has(normalizeName(item.rawName)))
    .map((item) => ({
      rawName: item.rawName,
      ...(item.portionDescription ? { portionDescription: item.portionDescription } : {}),
      note: "AI图片识别，建议核对",
    }));
  return { ...args, data: { ...data, items: [...current, ...additions] } };
}

function renderVisionItems(items: MealVisionItem[]) {
  if (!items.length) return "";
  return `<ul class="items">${items.map((item) => `<li>${escapeHtml(item.rawName)}${item.portionDescription ? ` · ${escapeHtml(item.portionDescription)}` : ""}</li>`).join("")}</ul>`;
}

export async function GET(request: Request) {
  const token = readToken(request.url);
  const payload = token ? resolveLifeMediaRecovery(token) : null;
  if (!payload) {
    return page("上传链接已失效", `<h1>上传链接已失效</h1><p class="error">这个链接无效或已经超过 10 分钟。请返回 AI 对话，重新发起一次需要保存图片的饮食记录。</p>`, 400);
  }

  return page(
    "补传饮食照片",
    `<h1>补传这张饮食照片</h1><p>选择同一张照片即可。系统会自动压缩原图、保存到正式饮食记录，并在服务端尝试识别照片里的食物。</p><form class="upload" method="post" enctype="multipart/form-data"><input type="hidden" name="token" value="${escapeHtml(token)}"><input type="file" name="image" accept="image/*" required><button type="submit">上传、识别并完成记录</button></form><small>链接约 10 分钟后失效。AI 识别结果只补充可较可靠辨认的食物，不自动估算热量、克数或营养素。</small>`,
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
  if (!payload) return page("上传链接已失效", `<h1>上传链接已失效</h1><p class="error">请返回 AI 对话重新发起图片记录。</p>`, 400);

  const image = form.get("image");
  if (!(image instanceof File) || image.size <= 0) return page("请选择图片", `<h1>请选择图片</h1><p class="error">没有收到图片文件。</p>`, 400);
  if (!image.type.toLowerCase().startsWith("image/")) return page("文件类型不支持", `<h1>文件类型不支持</h1><p class="error">这里只接受图片文件。</p>`, 415);
  if (image.size > MEAL_PHOTO_MAX_INPUT_BYTES) return page("图片过大", `<h1>图片过大</h1><p class="error">请选择体积更小的原图后重试。</p>`, 413);

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

    const vision = await recognizeMealPhoto({ bytes: compressed.bytes, contentType: "image/webp" });
    const args = vision.ok ? mergeVisionItems(payload.args, vision.items) : payload.args;
    const identity = {
      partnerKey: payload.partnerKey,
      displayName: payload.partnerKey === "cat" ? "猫猫" : "鱼鱼",
    } as const;
    await executeLifeAgentTool("life_mutate", args, {
      identity,
      latestUserText: payload.userText,
      attachment,
      toolCallId: payload.operationId,
    });

    if (vision.ok) {
      return page(
        "照片和饮食已完成",
        `<div class="ok">✅</div><h1>照片和饮食记录已完成</h1><p>原图已经压缩保存，并绑定到刚才的饮食记录。</p><p><strong>识别到：</strong>${escapeHtml(vision.summary)}</p>${renderVisionItems(vision.items)}<p class="muted">图片识别可能有误，食物名称和份量建议在饮食页面或 AI 对话中核对。内部数据库字段不会在这里展示。</p>`,
      );
    }

    return page(
      "照片已保存",
      `<div class="ok">✅</div><h1>照片已保存到饮食记录</h1><p>原图已经压缩并绑定成功。本次服务端图片识别没有完成：${escapeHtml(vision.summary)}。</p><p class="muted">照片保存不受影响，原有饮食文字也不会因为识别失败而丢失。配置视觉服务后可自动补全食物内容。</p>`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return page("保存失败", `<h1>保存失败</h1><p class="error">${escapeHtml(message)}</p><p>没有把失败结果伪装成成功。你可以返回 AI 对话重新确认记录内容。</p>`, 500);
  }
}
