import { NextResponse } from "next/server";
import {
  LIFE_NO_STORE_HEADERS,
  authorizeLifeRequest,
  lifeJsonError,
  readJsonBody,
} from "@/lib/server/life-api";
import { resolveFixedLifeIdentity } from "@/lib/server/fixed-life-auth";
import {
  getLifeReminderSettings,
  updateLifeReminderSettings,
} from "@/lib/server/life-reminder-center";

function actor(request: Request) {
  return resolveFixedLifeIdentity(request)?.partnerKey ?? null;
}

function fail(error: unknown) {
  return lifeJsonError(
    error instanceof Error ? error.message : "提醒设置暂时不可用",
    502,
    "REMINDER_SETTINGS_ERROR",
  );
}

export async function GET(request: Request) {
  const auth = await authorizeLifeRequest(request);
  if (auth) return auth;

  const currentActor = actor(request);
  if (!currentActor) return lifeJsonError("请先登录", 401, "UNAUTHORIZED");

  try {
    return NextResponse.json(
      { ok: true, settings: await getLifeReminderSettings(currentActor) },
      { headers: LIFE_NO_STORE_HEADERS },
    );
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request) {
  const auth = await authorizeLifeRequest(request);
  if (auth) return auth;

  const currentActor = actor(request);
  if (!currentActor) return lifeJsonError("请先登录", 401, "UNAUTHORIZED");

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  const medicineReminderEnabled = parsed.value?.medicineReminderEnabled;
  const medicineOffsets = parsed.value?.medicineOffsets;
  if (
    typeof medicineReminderEnabled !== "boolean" ||
    !Array.isArray(medicineOffsets) ||
    medicineOffsets.length < 1 ||
    medicineOffsets.length > 10 ||
    medicineOffsets.some(
      (value: unknown) =>
        !Number.isInteger(value) || Number(value) < 0 || Number(value) > 90,
    )
  ) {
    return lifeJsonError("药箱提醒设置无效", 400, "INVALID_REMINDER_SETTINGS");
  }

  try {
    const settings = await updateLifeReminderSettings(currentActor, {
      medicineReminderEnabled,
      medicineOffsets: medicineOffsets.map(Number),
    });
    return NextResponse.json(
      { ok: true, settings },
      { headers: LIFE_NO_STORE_HEADERS },
    );
  } catch (error) {
    return fail(error);
  }
}
