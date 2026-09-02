import { NextResponse } from "next/server";
import { authorizeLifeRequest, LIFE_NO_STORE_HEADERS, lifeJsonError, readJsonBody } from "@/lib/server/life-api";
import { resolveFixedLifeIdentity } from "@/lib/server/fixed-life-auth";
import { deleteMailboxLetter, getMailboxSender, MailboxCloudError, updateMailboxLetter } from "@/lib/server/supabase-mailbox";
import { parseMailboxPayload } from "@/lib/life/mailbox-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorizeOwnedLetter(request: Request, id: string) {
  const auth = await authorizeLifeRequest(request); if (auth) return auth;
  const identity = resolveFixedLifeIdentity(request);
  if (!identity) return lifeJsonError("请先登录", 401, "UNAUTHORIZED");
  const sender = await getMailboxSender(id);
  if (!sender) return lifeJsonError("信件不存在或已删除", 404, "NOT_FOUND");
  if (sender !== identity.partnerKey) return lifeJsonError("只能修改自己寄出的信", 403, "OWN_RECORD_ONLY");
  return null;
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const auth = await authorizeOwnedLetter(request, id); if (auth) return auth;
    const body = await readJsonBody(request); if (!body.ok) return body.response;
    const parsed = parseMailboxPayload(body.value); if (!parsed.ok) return lifeJsonError(parsed.reason, 400, "BAD_REQUEST");
    const identity = resolveFixedLifeIdentity(request);
    if (!identity || parsed.value.senderKey !== identity.partnerKey || parsed.value.recipientKey === identity.partnerKey) {
      return lifeJsonError("寄件人必须是当前账号，收件人必须是 Ta", 403, "OWN_RECORD_ONLY");
    }
    return NextResponse.json({ ok: true, letter: await updateMailboxLetter(id, parsed.value) }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) { return lifeJsonError(error instanceof MailboxCloudError ? error.message : "保存信件失败", 502, "MAILBOX_WRITE_FAILED"); }
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const auth = await authorizeOwnedLetter(request, id); if (auth) return auth;
    return NextResponse.json({ ok: true, letter: await deleteMailboxLetter(id) }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) { return lifeJsonError(error instanceof MailboxCloudError ? error.message : "删除信件失败", 502, "MAILBOX_WRITE_FAILED"); }
}
