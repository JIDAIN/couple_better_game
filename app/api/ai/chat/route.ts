import { NextResponse } from "next/server";
import { compressMealPhoto, MealPhotoCompressionError } from "@/lib/server/image-compression";
import { resolveFixedLifeIdentity } from "@/lib/server/fixed-life-auth";
import { LifeAiGatewayError, runLifeAiAgent } from "@/lib/server/life-ai-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function jsonError(message: string, status: number, code: string) {
  return NextResponse.json({ ok: false, error: message, code }, { status, headers: NO_STORE_HEADERS });
}

function parseHistory(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const identity = resolveFixedLifeIdentity(request);
  if (!identity) return jsonError("请先登录岛屿生活", 401, "AUTH_REQUIRED");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("请求格式不正确", 400, "BAD_REQUEST");
  }

  const messageEntry = form.get("message");
  const message = typeof messageEntry === "string" ? messageEntry.trim().slice(0, 12000) : "";
  const history = parseHistory(form.get("history"));
  const image = form.get("image");

  let attachment = null;
  if (image instanceof File && image.size > 0) {
    try {
      const compressed = await compressMealPhoto(await image.arrayBuffer(), image.type);
      attachment = {
        bytes: compressed.bytes,
        contentType: compressed.contentType,
        extension: compressed.extension,
        width: compressed.width,
        height: compressed.height,
        outputBytes: compressed.outputBytes,
      } as const;
    } catch (error) {
      if (error instanceof MealPhotoCompressionError) {
        return jsonError(error.message, 400, error.code);
      }
      return jsonError("处理图片失败", 400, "PHOTO_INVALID");
    }
  }

  if (!message && !attachment) {
    return jsonError("请输入消息或选择一张图片", 400, "MESSAGE_REQUIRED");
  }

  try {
    const result = await runLifeAiAgent({ identity, message, history, attachment });
    return NextResponse.json(
      {
        ok: true,
        reply: result.text,
        operations: result.operations,
        model: result.model,
        attachment: attachment
          ? { width: attachment.width, height: attachment.height, bytes: attachment.outputBytes }
          : null,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof LifeAiGatewayError) {
      const status = error.code === "AI_NOT_CONFIGURED" ? 503 : 502;
      return jsonError(error.message, status, error.code);
    }
    const messageText = error instanceof Error ? error.message : "AI 请求失败";
    return jsonError(messageText, 502, "AI_REQUEST_FAILED");
  }
}
