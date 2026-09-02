import { NextResponse } from "next/server";
import { getLifeIdentity, setLifeAuthCookies, signUpLifeUser } from "@/lib/server/life-auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string; displayName?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const displayName = body.displayName?.trim() ?? "";
    if (!email || !password) return NextResponse.json({ ok: false, error: "请输入邮箱和密码" }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ ok: false, error: "密码至少需要 8 位" }, { status: 400 });
    const result = await signUpLifeUser(email, password, displayName || undefined);
    if (!result.access_token || !result.refresh_token) {
      return NextResponse.json({ ok: true, requiresEmailConfirmation: true, identity: null });
    }
    const identity = await getLifeIdentity(result.access_token);
    const response = NextResponse.json({ ok: true, requiresEmailConfirmation: false, identity });
    setLifeAuthCookies(response, {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_in: result.expires_in,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "注册失败" }, { status: 400 });
  }
}
