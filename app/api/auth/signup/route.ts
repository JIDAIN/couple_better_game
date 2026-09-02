import { NextResponse } from "next/server";
import { setLifeSessionCookies } from "@/lib/server/life-auth-response";
import { hasSupabaseAuthConfig, signUpLifeUser } from "@/lib/server/supabase-auth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasSupabaseAuthConfig()) {
    return NextResponse.json({ ok: false, error: "Supabase Auth 环境变量未配置" }, { status: 500 });
  }
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
    displayName?: unknown;
  } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  if (!email || password.length < 8) {
    return NextResponse.json({ ok: false, error: "请输入有效邮箱，密码至少 8 位" }, { status: 400 });
  }
  try {
    const session = await signUpLifeUser({ email, password, displayName });
    if (!session.access_token || !session.refresh_token) {
      return NextResponse.json({ ok: true, needsEmailConfirmation: true });
    }
    const response = NextResponse.json({ ok: true, needsEmailConfirmation: false });
    return setLifeSessionCookies(response, session);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "注册失败" },
      { status: 400 },
    );
  }
}
