import { NextResponse } from "next/server";
import { parseLifeSettingsPatch } from "@/lib/life/settings-service";
import { getLifeSettings, updateLifeSettings } from "@/lib/server/life-data-management";
import { resolveFixedLifeIdentity } from "@/lib/server/fixed-life-auth";
import {
  authorizeLifeRequest,
  LIFE_NO_STORE_HEADERS,
  lifeJsonError,
  readJsonBody,
} from "@/lib/server/life-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await authorizeLifeRequest(request);
  if (authError) return authError;
  try {
    const settings = await getLifeSettings();
    return NextResponse.json({ ok: true, settings }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    return lifeJsonError(error instanceof Error ? error.message : "读取生活设置失败", 502, "SETTINGS_READ_FAILED");
  }
}

export async function PATCH(request: Request) {
  const authError = await authorizeLifeRequest(request);
  if (authError) return authError;
  const identity = resolveFixedLifeIdentity(request);
  if (!identity) return lifeJsonError("请先登录", 401, "UNAUTHORIZED");
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const parsed = parseLifeSettingsPatch(body.value);
  if (!parsed.ok) return lifeJsonError(parsed.reason, 400, "BAD_REQUEST");
  try {
    const settings = await updateLifeSettings(parsed.value, identity.partnerKey);
    return NextResponse.json({ ok: true, settings }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    return lifeJsonError(error instanceof Error ? error.message : "保存生活设置失败", 502, "SETTINGS_WRITE_FAILED");
  }
}
