import { NextResponse } from "next/server";
import { getLifeIdentity, setLifeAuthCookies, signInLifeUser } from "@/lib/server/life-auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    if (!email || !password) return NextResponse.json({ ok: false, error: "请输入邮箱和密码" }, { status: 400 });
    const session = await signInLifeUser(email, password);
    const identity = await getLifeIdentity(session.access_token);
    const response = NextResponse.json({ ok: true, identity });
    setLifeAuthCookies(response, session);
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "登录失败" }, { status: 401 });
  }
}
