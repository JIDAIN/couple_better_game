import { NextResponse } from "next/server";
import { verifyDriveBridgeRequest } from "@/lib/server/drive-bridge-auth";
import {
  claimLifeWechatReminders,
  completeLifeWechatReminder,
} from "@/lib/server/life-wechat-reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const auth = await verifyDriveBridgeRequest(request, rawBody);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, error: auth.message },
      { status: auth.status, headers: NO_STORE },
    );
  }

  let payload: JsonRecord;
  try {
    payload = asRecord(JSON.parse(rawBody || "{}"));
  } catch {
    return NextResponse.json(
      { ok: false, code: "BAD_JSON", error: "请求 JSON 不正确" },
      { status: 400, headers: NO_STORE },
    );
  }

  const action = stringValue(payload.action);
  try {
    if (action === "claim") {
      const result = await claimLifeWechatReminders(auth.identity.partnerKey);
      return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE });
    }

    if (action === "complete") {
      const deliveryId = stringValue(payload.deliveryId);
      if (typeof payload.accepted !== "boolean") {
        return NextResponse.json(
          { ok: false, code: "ACCEPTED_REQUIRED", error: "complete 需要 accepted=true/false" },
          { status: 400, headers: NO_STORE },
        );
      }
      const result = await completeLifeWechatReminder(auth.identity.partnerKey, {
        deliveryId,
        accepted: payload.accepted,
        providerMessageId: stringValue(payload.providerMessageId) || null,
        error: stringValue(payload.error) || null,
      });
      return NextResponse.json({ ok: true, delivery: result }, { headers: NO_STORE });
    }

    return NextResponse.json(
      { ok: false, code: "ACTION_INVALID", error: "action 只能是 claim 或 complete" },
      { status: 400, headers: NO_STORE },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "WECHAT_REMINDER_FAILED",
        error: error instanceof Error ? error.message : "微信提醒处理失败",
      },
      { status: 400, headers: NO_STORE },
    );
  }
}
