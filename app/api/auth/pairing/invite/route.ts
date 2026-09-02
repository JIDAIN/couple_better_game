import { NextResponse } from "next/server";
import { callAuthenticatedRpc, resolveLifeAuth } from "@/lib/server/supabase-auth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await resolveLifeAuth(request);
  if (!auth) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  if (!auth.identity.coupleSpaceId || !auth.identity.partnerKey) {
    return NextResponse.json({ ok: false, error: "请先完成自己的身份绑定" }, { status: 409 });
  }
  const body = (await request.json().catch(() => null)) as { partnerKey?: unknown } | null;
  const target = body?.partnerKey === "cat" || body?.partnerKey === "fish"
    ? body.partnerKey
    : auth.identity.partnerKey === "cat" ? "fish" : "cat";
  if (target === auth.identity.partnerKey) {
    return NextResponse.json({ ok: false, error: "邀请身份必须是另一方" }, { status: 400 });
  }
  try {
    const invite = await callAuthenticatedRpc<{ code: string; partnerKey: string; expiresAt: string }>(
      auth.accessToken,
      "create_couple_space_invite",
      { p_partner_key: target },
    );
    return NextResponse.json({ ok: true, invite }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "生成邀请码失败" },
      { status: 400 },
    );
  }
}
