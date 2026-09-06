type JsonRecord = Record<string, unknown>;

export type MealVisionItem = {
  rawName: string;
  portionDescription?: string;
  confidence: number;
};

export type MealVisionResult = {
  ok: boolean;
  items: MealVisionItem[];
  summary: string;
  model?: string;
  errorCode?: string;
};

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-5.6-luna";
const MIN_CONFIDENCE = 0.6;

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseJsonText(value: string): JsonRecord | null {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return asRecord(JSON.parse(cleaned));
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return asRecord(JSON.parse(cleaned.slice(start, end + 1)));
    } catch {
      return null;
    }
  }
}

export function normalizeMealVisionPayload(value: unknown): MealVisionResult {
  const row = asRecord(value);
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const items = rawItems
    .map((entry) => {
      const item = asRecord(entry);
      const rawName = text(item.rawName ?? item.name);
      const portionDescription = text(item.portionDescription ?? item.portion);
      const confidenceValue = Number(item.confidence);
      const confidence = Number.isFinite(confidenceValue) ? Math.max(0, Math.min(1, confidenceValue)) : 0.7;
      if (!rawName || confidence < MIN_CONFIDENCE) return null;
      return {
        rawName,
        ...(portionDescription ? { portionDescription } : {}),
        confidence,
      } satisfies MealVisionItem;
    })
    .filter((item): item is MealVisionItem => Boolean(item));

  return {
    ok: items.length > 0,
    items,
    summary: text(row.summary) || (items.length ? items.map((item) => item.rawName).join("、") : "未可靠识别出食物"),
  };
}

function extractOutputText(response: JsonRecord) {
  const direct = text(response.output_text);
  if (direct) return direct;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const entry of output) {
    const item = asRecord(entry);
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      const piece = asRecord(part);
      const candidate = text(piece.text ?? piece.output_text);
      if (candidate) return candidate;
    }
  }
  return "";
}

export async function recognizeMealPhoto(input: { bytes: Buffer; contentType: string }): Promise<MealVisionResult> {
  const apiKey = env("LIFE_VISION_API_KEY") || env("OPENAI_API_KEY");
  if (!apiKey) {
    return { ok: false, items: [], summary: "服务端视觉识别尚未配置", errorCode: "VISION_NOT_CONFIGURED" };
  }

  const baseUrl = (env("LIFE_VISION_BASE_URL") || DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = env("LIFE_VISION_MODEL") || DEFAULT_MODEL;
  const dataUrl = `data:${input.contentType};base64,${input.bytes.toString("base64")}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: "识别这张饮食照片里实际可见的食物。只返回 JSON，不要 markdown。格式：{\"items\":[{\"rawName\":\"食物名\",\"portionDescription\":\"可见份量，没有把握可留空\",\"confidence\":0到1}],\"summary\":\"简短中文总结\"}。不要猜看不清的食物，不要估算卡路里、克数或营养素；confidence 低于0.6的不要输出。",
            },
            { type: "input_image", image_url: dataUrl },
          ],
        }],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, items: [], summary: "视觉识别服务暂时不可用", model, errorCode: `VISION_HTTP_${response.status}` };
    }
    const payload = asRecord(await response.json());
    const outputText = extractOutputText(payload);
    const parsed = outputText ? parseJsonText(outputText) : null;
    if (!parsed) return { ok: false, items: [], summary: "视觉模型未返回可解析结果", model, errorCode: "VISION_INVALID_OUTPUT" };
    return { ...normalizeMealVisionPayload(parsed), model };
  } catch (error) {
    const code = error instanceof Error && error.name === "AbortError" ? "VISION_TIMEOUT" : "VISION_REQUEST_FAILED";
    return { ok: false, items: [], summary: "视觉识别暂时失败，但图片仍可正常保存", model, errorCode: code };
  } finally {
    clearTimeout(timer);
  }
}
