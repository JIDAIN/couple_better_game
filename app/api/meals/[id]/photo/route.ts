import { NextResponse } from "next/server";
import {
  defaultMealPhotoDisplay,
  isUuid,
  parseMealPhotoDisplayPayload,
} from "../../../../../lib/nutrition/meal-service";
import {
  MealPhotoCompressionError,
  compressMealPhoto,
} from "../../../../../lib/server/image-compression";
import { authorizeLifeRequest, authorizePersonalPartnerWrite } from "../../../../../lib/server/life-api";
import {
  buildMealPhotoPath,
  deleteMealPhotoObject,
  downloadMealPhotoObject,
  getMealOwner,
  getMealPhotoPath,
  NutritionCloudError,
  replaceMealPhotoState,
  updateMealPhotoDisplay,
  uploadMealPhotoObject,
} from "../../../../../lib/server/supabase-nutrition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function jsonError(message: string, status: number, errorCode: string) {
  return NextResponse.json({ ok: false, error: message, errorCode }, { status });
}

async function mealId(context: RouteContext) {
  const { id } = await context.params;
  return isUuid(id) ? id : null;
}

function cloudError(error: NutritionCloudError) {
  const notFound = error.message.includes("Meal not found") || error.message.includes("Meal photo not found");
  const status = error.errorCode === "SERVER_CONFIG" ? 500 : notFound ? 404 : 502;
  return jsonError(error.message, status, error.errorCode);
}

function compressionError(error: MealPhotoCompressionError) {
  return jsonError(error.message, 400, error.code);
}

async function authorizePhotoWrite(request: Request, id: string) {
  const owner = await getMealOwner(id);
  if (!owner) return jsonError("餐食不存在或已删除", 404, "NOT_FOUND");
  return authorizePersonalPartnerWrite(request, owner);
}

export async function GET(request: Request, context: RouteContext) {
  const authError = await authorizeLifeRequest(request);
  if (authError) return authError;
  const id = await mealId(context);
  if (!id) return jsonError("餐食 ID 格式不正确", 400, "BAD_REQUEST");

  try {
    const path = await getMealPhotoPath(id);
    if (!path) return jsonError("这餐没有上传照片", 404, "PHOTO_NOT_FOUND");
    const storageResponse = await downloadMealPhotoObject(path);
    return new Response(await storageResponse.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": storageResponse.headers.get("content-type") || "image/webp",
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof NutritionCloudError) return cloudError(error);
    return jsonError("读取餐食照片失败", 502, "PHOTO_READ_FAILED");
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const id = await mealId(context);
  if (!id) return jsonError("餐食 ID 格式不正确", 400, "BAD_REQUEST");
  try {
    const authError = await authorizePhotoWrite(request, id);
    if (authError) return authError;
  } catch (error) {
    if (error instanceof NutritionCloudError) return cloudError(error);
    return jsonError("读取餐食归属失败", 502, "NUTRITION_READ_FAILED");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("照片上传格式不正确", 400, "BAD_REQUEST");
  }
  const value = form.get("file");
  if (!(value instanceof File)) return jsonError("请选择一张照片", 400, "PHOTO_REQUIRED");

  let compressed;
  try {
    compressed = await compressMealPhoto(await value.arrayBuffer(), value.type);
  } catch (error) {
    if (error instanceof MealPhotoCompressionError) return compressionError(error);
    return jsonError("无法处理这张照片", 400, "PHOTO_DECODE_FAILED");
  }

  const path = buildMealPhotoPath(id, compressed.extension);
  const display = defaultMealPhotoDisplay(compressed.width, compressed.height);
  try {
    const bytes = compressed.bytes.buffer.slice(
      compressed.bytes.byteOffset,
      compressed.bytes.byteOffset + compressed.bytes.byteLength,
    ) as ArrayBuffer;
    await uploadMealPhotoObject(path, bytes, compressed.contentType);
    let replacement;
    try {
      replacement = await replaceMealPhotoState(id, path, display);
    } catch (error) {
      await deleteMealPhotoObject(path).catch(() => undefined);
      throw error;
    }
    if (replacement.previousPhotoPath && replacement.previousPhotoPath !== path) {
      await deleteMealPhotoObject(replacement.previousPhotoPath).catch(() => undefined);
    }
    return NextResponse.json(
      {
        ok: true,
        meal: replacement.meal,
        photo: {
          width: compressed.width,
          height: compressed.height,
          quality: compressed.quality,
          originalBytes: compressed.originalBytes,
          outputBytes: compressed.outputBytes,
          contentType: compressed.contentType,
          rotationDegrees: display.rotationDegrees,
          scale: display.scale,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof NutritionCloudError) return cloudError(error);
    return jsonError("上传餐食照片失败", 502, "PHOTO_WRITE_FAILED");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const id = await mealId(context);
  if (!id) return jsonError("餐食 ID 格式不正确", 400, "BAD_REQUEST");
  try {
    const authError = await authorizePhotoWrite(request, id);
    if (authError) return authError;
  } catch (error) {
    if (error instanceof NutritionCloudError) return cloudError(error);
    return jsonError("读取餐食归属失败", 502, "NUTRITION_READ_FAILED");
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("照片显示设置格式不正确", 400, "BAD_REQUEST");
  }
  const parsed = parseMealPhotoDisplayPayload(raw);
  if (!parsed.ok) return jsonError(parsed.reason, 400, "BAD_REQUEST");

  try {
    const meal = await updateMealPhotoDisplay(id, parsed.value);
    return NextResponse.json({ ok: true, meal }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof NutritionCloudError) return cloudError(error);
    return jsonError("保存照片显示设置失败", 502, "PHOTO_WRITE_FAILED");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const id = await mealId(context);
  if (!id) return jsonError("餐食 ID 格式不正确", 400, "BAD_REQUEST");
  try {
    const authError = await authorizePhotoWrite(request, id);
    if (authError) return authError;
    const replacement = await replaceMealPhotoState(id, null, { rotationDegrees: 0, scale: 1 });
    if (replacement.previousPhotoPath) {
      await deleteMealPhotoObject(replacement.previousPhotoPath).catch(() => undefined);
    }
    return NextResponse.json({ ok: true, meal: replacement.meal }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof NutritionCloudError) return cloudError(error);
    return jsonError("删除餐食照片失败", 502, "PHOTO_WRITE_FAILED");
  }
}
