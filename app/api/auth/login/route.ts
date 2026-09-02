import { NextResponse } from "next/server";
import { setLifeSessionCookies } from "@/lib/server/life-auth-response";
import { hasSupabaseAuthConfig, signInLifeUser } from "@/lib/server/supabase-auth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasSupabaseAuthConfig()) {
    return NextResponse.json({ ok: false, error: "Supabase Auth 环境变量未配置" }, { status: 500 });
  }
  const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || password.length < 6) {
    return NextResponse.json({ ok: false, error: "请输入有效邮箱和密码" }, { status: 400 });
  }
  try {
    const session = await signInLifeUser(email, password);
    const response = NextResponse.json({ ok: true });
    return setLifeSessionCookies(response, session);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "登录失败" },
      { status: 401 },
    );
  }
}
