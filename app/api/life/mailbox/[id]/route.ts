import { NextResponse } from "next/server";
import { authorizeLifeRequest, LIFE_NO_STORE_HEADERS, lifeJsonError, readJsonBody } from "@/lib/server/life-api";
import { deleteMailboxLetter, MailboxCloudError, updateMailboxLetter } from "@/lib/server/supabase-mailbox";
import { parseMailboxPayload } from "@/lib/life/mailbox-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLifeRequest(request); if (auth) return auth;
  const body = await readJsonBody(request); if (!body.ok) return body.response;
  const parsed = parseMailboxPayload(body.value); if (!parsed.ok) return lifeJsonError(parsed.reason, 400, "BAD_REQUEST");
  const { id } = await context.params;
  try { return NextResponse.json({ ok: true, letter: await updateMailboxLetter(id, parsed.value) }, { headers: LIFE_NO_STORE_HEADERS }); }
  catch (error) { return lifeJsonError(error instanceof MailboxCloudError ? error.message : "保存信件失败", 502, "MAILBOX_WRITE_FAILED"); }
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLifeRequest(request); if (auth) return auth;
  const { id } = await context.params;
  try { return NextResponse.json({ ok: true, letter: await deleteMailboxLetter(id) }, { headers: LIFE_NO_STORE_HEADERS }); }
  catch (error) { return lifeJsonError(error instanceof MailboxCloudError ? error.message : "删除信件失败", 502, "MAILBOX_WRITE_FAILED"); }
}
