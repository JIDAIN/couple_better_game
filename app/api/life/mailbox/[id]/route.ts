import { NextResponse } from "next/server";
import {
  authorizeLifeRequest,
  LIFE_NO_STORE_HEADERS,
  lifeJsonError,
  readJsonBody,
} from "@/lib/server/life-api";
import { resolveFixedLifeIdentity } from "@/lib/server/fixed-life-auth";
import {
  deleteMailboxDraft,
  MailboxCloudError,
  sendMailboxDraft,
  updateMailboxDraft,
} from "@/lib/server/supabase-mailbox";
import { parseMailboxPayload, type MailboxPartnerKey } from "@/lib/life/mailbox-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
type ResolvedMailboxIdentity =
  | { response: Response; actor: null; id: null }
  | { response: null; actor: MailboxPartnerKey; id: string };

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function fail(error: unknown, fallback: string) {
  if (error instanceof MailboxCloudError) {
    if (/immutable|already sent/i.test(error.message)) {
      return lifeJsonError("已寄出的内容不能再修改或删除", 409, "MAILBOX_IMMUTABLE");
    }
    if (/not found/i.test(error.message)) {
      return lifeJsonError("待寄出内容不存在", 404, "NOT_FOUND");
    }
    return lifeJsonError(error.message, 502, "MAILBOX_WRITE_FAILED");
  }
  return lifeJsonError(fallback, 502, "MAILBOX_WRITE_FAILED");
}

async function identityAndId(
  request: Request,
  context: RouteContext,
): Promise<ResolvedMailboxIdentity> {
  const auth = await authorizeLifeRequest(request);
  if (auth) return { response: auth, actor: null, id: null };

  const identity = resolveFixedLifeIdentity(request);
  if (!identity) {
    return {
      response: lifeJsonError("请先登录", 401, "UNAUTHORIZED"),
      actor: null,
      id: null,
    };
  }

  const { id } = await context.params;
  if (!isUuid(id)) {
    return {
      response: lifeJsonError("信件 ID 格式不正确", 400, "BAD_REQUEST"),
      actor: null,
      id: null,
    };
  }

  return { response: null, actor: identity.partnerKey, id };
}

export async function PUT(request: Request, context: RouteContext) {
  const resolved = await identityAndId(request, context);
  if (resolved.response) return resolved.response;
  const { actor, id } = resolved;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const raw = body.value && typeof body.value === "object" && !Array.isArray(body.value)
    ? body.value
    : {};
  const ta = actor === "cat" ? "fish" : "cat";
  const parsed = parseMailboxPayload({
    ...raw,
    senderKey: actor,
    recipientKey: ta,
    status: "draft",
    sentAt: null,
  });
  if (!parsed.ok) return lifeJsonError(parsed.reason, 400, "BAD_REQUEST");

  try {
    const letter = await updateMailboxDraft(actor, id, parsed.value, "manual");
    return NextResponse.json({ ok: true, letter }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    return fail(error, "保存草稿失败");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const resolved = await identityAndId(request, context);
  if (resolved.response) return resolved.response;
  const { actor, id } = resolved;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  if (body.value?.action !== "send") {
    return lifeJsonError("不支持的信件操作", 400, "BAD_REQUEST");
  }

  try {
    const letter = await sendMailboxDraft(actor, id, "manual");
    return NextResponse.json({ ok: true, letter }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    return fail(error, "寄出失败");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const resolved = await identityAndId(request, context);
  if (resolved.response) return resolved.response;
  const { actor, id } = resolved;

  try {
    const letter = await deleteMailboxDraft(actor, id);
    return NextResponse.json({ ok: true, letter }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    return fail(error, "删除草稿失败");
  }
}
