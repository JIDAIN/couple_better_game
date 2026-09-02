import { NextResponse } from "next/server";
import { isUuid } from "../../../../../lib/nutrition/meal-service";
import { requireLifeIdentity } from "../../../../../lib/server/life-api";
import { mealOwnerKey } from "../../../../../lib/server/life-record-owner";
import {
  buildMealPhotoPath,
  deleteMealPhotoObject,
  downloadMealPhotoObject,
  getMealPhotoPath,
  NutritionCloudError,
  replaceMealPhotoPath,
  uploadMealPhotoObject,
} from "../../../../../lib/server/supabase-nutrition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

type RouteContext = { params: Promise<{ id: string }> };

function jsonError(message: string, status: number, errorCode: string) {
  return NextResponse.json({ ok: false, error: message, errorCode }, { status });
}

async function mealId(context: RouteContext) {
  const { id } = await context.params;
  return isUuid(id) ? id : null;
}

function cloudError(error: NutritionCloudError) {
  const status = error.errorCode === "SERVER_CONFIG" ? 500 : error.message.includes("Meal not found") ? 404 : 502;
  return jsonError(error.message, status, error.errorCode);
}

async function requireOwner(request: Request, id: string) {
  const auth = await requireLifeIdentity(request);
  if (auth.response) return { response: auth.response };
  const owner = await mealOwnerKey(id);
  if (!owner) return { response: jsonError("餐食不存在", 404, "NOT_FOUND") };
  if (owner !== auth.identity.partnerKey) return { response: jsonError("只能修改自己的餐食照片", 403, "FORBIDDEN") };
  return { response: null };
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireLifeIdentity(request);
  if (auth.response) return auth.response;
  const id = await mealId(context);
  if (!id) return jsonError("餐食 ID 格式不正确", 400, "BAD_REQUEST");

  try {
    const path = await getMealPhotoPath(id);
    if (!path) return jsonError("这餐没有上传照片", 404, "PHOTO_NOT_FOUND");
    const storageResponse = await downloadMealPhotoObject(path);
    return new Response(await storageResponse.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": storageResponse.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "private, max-age=300",
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
  const auth = await requireOwner(request, id);
  if (auth.response) return auth.response;

  let form: FormData;
  try { form = await request.formData(); } catch { return jsonError("照片上传格式不正确", 400, "BAD_REQUEST"); }
  const value = form.get("file");
  if (!(value instanceof File)) return jsonError("请选择一张照片", 400, "PHOTO_REQUIRED");
  if (value.size <= 0 || value.size > MAX_PHOTO_BYTES) return jsonError("照片大小需要在 10MB 以内", 400, "PHOTO_TOO_LARGE");
  const extension = MIME_TO_EXTENSION[value.type.toLowerCase()];
  if (!extension) return jsonError("仅支持 JPEG、PNG、WebP、HEIC/HEIF 图片", 400, "PHOTO_TYPE_UNSUPPORTED");

  const path = buildMealPhotoPath(id, extension);
  try {
    await uploadMealPhotoObject(path, await value.arrayBuffer(), value.type);
    let replacement;
    try { replacement = await replaceMealPhotoPath(id, path); }
    catch (error) { await deleteMealPhotoObject(path).catch(() => undefined); throw error; }
    if (replacement.previousPhotoPath && replacement.previousPhotoPath !== path) {
      await deleteMealPhotoObject(replacement.previousPhotoPath).catch(() => undefined);
    }
    return NextResponse.json({ ok: true, meal: replacement.meal }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof NutritionCloudError) return cloudError(error);
    return jsonError("上传餐食照片失败", 502, "PHOTO_WRITE_FAILED");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const id = await mealId(context);
  if (!id) return jsonError("餐食 ID 格式不正确", 400, "BAD_REQUEST");
  const auth = await requireOwner(request, id);
  if (auth.response) return auth.response;

  try {
    const replacement = await replaceMealPhotoPath(id, null);
    if (replacement.previousPhotoPath) await deleteMealPhotoObject(replacement.previousPhotoPath).catch(() => undefined);
    return NextResponse.json({ ok: true, meal: replacement.meal }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof NutritionCloudError) return cloudError(error);
    return jsonError("删除餐食照片失败", 502, "PHOTO_WRITE_FAILED");
  }
}
