import { NextResponse } from "next/server";
import { LIFE_NO_STORE_HEADERS, lifeJsonError, readJsonBody, requireLifeIdentity } from "@/lib/server/life-api";
import { createMailboxLetter, listMailboxLetters, MailboxCloudError } from "@/lib/server/supabase-mailbox";
import { parseMailboxPayload } from "@/lib/life/mailbox-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireLifeIdentity(request);
  if (auth.response) return auth.response;
  try {
    return NextResponse.json({ ok: true, letters: await listMailboxLetters() }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    return lifeJsonError(error instanceof MailboxCloudError ? error.message : "读取小信箱失败", 502, "MAILBOX_READ_FAILED");
  }
}

export async function POST(request: Request) {
  const auth = await requireLifeIdentity(request);
  if (auth.response) return auth.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const senderKey = auth.identity.partnerKey!;
  const recipientKey = senderKey === "cat" ? "fish" : "cat";
  const raw = typeof body.value === "object" && body.value !== null && !Array.isArray(body.value)
    ? { ...body.value, senderKey, recipientKey }
    : body.value;
  const parsed = parseMailboxPayload(raw);
  if (!parsed.ok) return lifeJsonError(parsed.reason, 400, "BAD_REQUEST");
  try {
    return NextResponse.json({ ok: true, letter: await createMailboxLetter(parsed.value) }, { headers: LIFE_NO_STORE_HEADERS });
  } catch (error) {
    return lifeJsonError(error instanceof MailboxCloudError ? error.message : "寄信失败", 502, "MAILBOX_WRITE_FAILED");
  }
}
