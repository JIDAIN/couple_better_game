import { NextResponse } from "next/server";
import {
  authorizeLifeRequest,
  LIFE_NO_STORE_HEADERS,
  lifeJsonError,
  readJsonBody,
} from "@/lib/server/life-api";
import { resolveFixedLifeIdentity } from "@/lib/server/fixed-life-auth";
import {
  createMailboxItem,
  listMailboxItems,
  MailboxCloudError,
} from "@/lib/server/supabase-mailbox";
import { parseMailboxPayload, type MailboxStatus } from "@/lib/life/mailbox-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(error: unknown, fallback: string, code: string) {
  return lifeJsonError(
    error instanceof MailboxCloudError ? error.message : fallback,
    502,
    code,
  );
}

export async function GET(request: Request) {
  const auth = await authorizeLifeRequest(request);
  if (auth) return auth;
  const identity = resolveFixedLifeIdentity(request);
  if (!identity) return lifeJsonError("请先登录", 401, "UNAUTHORIZED");

  try {
    return NextResponse.json(
      { ok: true, letters: await listMailboxItems(identity.partnerKey) },
      { headers: LIFE_NO_STORE_HEADERS },
    );
  } catch (error) {
    return fail(error, "读取小信箱失败", "MAILBOX_READ_FAILED");
  }
}

export async function POST(request: Request) {
  const auth = await authorizeLifeRequest(request);
  if (auth) return auth;
  const identity = resolveFixedLifeIdentity(request);
  if (!identity) return lifeJsonError("请先登录", 401, "UNAUTHORIZED");

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const raw = body.value && typeof body.value === "object" && !Array.isArray(body.value)
    ? body.value
    : {};
  const status = raw.status;
  if (status !== "draft" && status !== "sent") {
    return lifeJsonError("请选择保存为待寄出或立即寄出", 400, "INVALID_MAILBOX_STATUS");
  }

  const ta = identity.partnerKey === "cat" ? "fish" : "cat";
  const parsed = parseMailboxPayload({
    ...raw,
    senderKey: identity.partnerKey,
    recipientKey: ta,
    status,
    sentAt: null,
  });
  if (!parsed.ok) return lifeJsonError(parsed.reason, 400, "BAD_REQUEST");

  try {
    const letter = await createMailboxItem(
      identity.partnerKey,
      parsed.value,
      status as MailboxStatus,
      "manual",
    );
    return NextResponse.json(
      { ok: true, letter },
      { status: 201, headers: LIFE_NO_STORE_HEADERS },
    );
  } catch (error) {
    return fail(error, status === "sent" ? "寄信失败" : "保存草稿失败", "MAILBOX_WRITE_FAILED");
  }
}
