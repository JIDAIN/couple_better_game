import { NextResponse } from "next/server";
import { callAuthenticatedRpc, resolveLifeAuth } from "@/lib/server/supabase-auth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await resolveLifeAuth(request);
  if (!auth) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  if (auth.identity.coupleSpaceId) {
    return NextResponse.json({ ok: false, error: "当前账号已经绑定双人空间" }, { status: 409 });
  }
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!/^[0-9A-F]{12}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "邀请码格式不正确" }, { status: 400 });
  }
  try {
    const identity = await callAuthenticatedRpc<{ coupleSpaceId: string; partnerKey: string }>(
      auth.accessToken,
      "accept_couple_space_invite",
      { p_code: code },
    );
    return NextResponse.json({ ok: true, identity }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "接受邀请失败" },
      { status: 400 },
    );
  }
}
