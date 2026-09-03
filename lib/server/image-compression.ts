import sharp from "sharp";

export const MEAL_PHOTO_MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const MEAL_PHOTO_MAX_EDGE = 600;
export const MEAL_PHOTO_INITIAL_QUALITY = 70;
export const MEAL_PHOTO_MIN_QUALITY = 55;
export const MEAL_PHOTO_MAX_OUTPUT_BYTES = 120 * 1024;

const QUALITY_STEPS = [70, 65, 60, 55] as const;
const SUPPORTED_INPUT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export type CompressedMealPhoto = {
  bytes: Buffer;
  contentType: "image/webp";
  extension: "webp";
  quality: number;
  width: number | null;
  height: number | null;
  originalBytes: number;
  outputBytes: number;
};

export class MealPhotoCompressionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "PHOTO_REQUIRED"
      | "PHOTO_TOO_LARGE"
      | "PHOTO_TYPE_UNSUPPORTED"
      | "PHOTO_DECODE_FAILED",
  ) {
    super(message);
  }
}

function toBuffer(input: ArrayBuffer | Uint8Array | Buffer) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof ArrayBuffer) return Buffer.from(new Uint8Array(input));
  return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
}

export async function compressMealPhoto(
  input: ArrayBuffer | Uint8Array | Buffer,
  mimeType: string,
): Promise<CompressedMealPhoto> {
  const source = toBuffer(input);
  const normalizedType = mimeType.trim().toLowerCase();
  if (source.length === 0) {
    throw new MealPhotoCompressionError("请选择一张照片", "PHOTO_REQUIRED");
  }
  if (source.length > MEAL_PHOTO_MAX_INPUT_BYTES) {
    throw new MealPhotoCompressionError("原始照片需要在 10MB 以内", "PHOTO_TOO_LARGE");
  }
  if (!SUPPORTED_INPUT_TYPES.has(normalizedType)) {
    throw new MealPhotoCompressionError(
      "仅支持 JPEG、PNG、WebP、HEIC/HEIF 图片",
      "PHOTO_TYPE_UNSUPPORTED",
    );
  }

  try {
    const normalized = sharp(source, { failOn: "error" })
      .rotate()
      .resize({
        width: MEAL_PHOTO_MAX_EDGE,
        height: MEAL_PHOTO_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      });

    let output = Buffer.alloc(0);
    let usedQuality = MEAL_PHOTO_INITIAL_QUALITY;
    for (const quality of QUALITY_STEPS) {
      output = await normalized.clone().webp({ quality, effort: 4 }).toBuffer();
      usedQuality = quality;
      if (output.length <= MEAL_PHOTO_MAX_OUTPUT_BYTES) break;
    }

    const metadata = await sharp(output).metadata();
    return {
      bytes: output,
      contentType: "image/webp",
      extension: "webp",
      quality: usedQuality,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      originalBytes: source.length,
      outputBytes: output.length,
    };
  } catch (error) {
    if (error instanceof MealPhotoCompressionError) throw error;
    throw new MealPhotoCompressionError("无法解析这张照片，请换一张图片重试", "PHOTO_DECODE_FAILED");
  }
}
