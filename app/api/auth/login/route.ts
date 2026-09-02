import { NextResponse } from "next/server";
import {
  authenticateFixedLifeAccount,
  createFixedLifeSession,
  LIFE_ACCOUNT_COOKIE,
} from "@/lib/server/fixed-life-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    username?: unknown;
    password?: unknown;
  } | null;

  try {
    const partnerKey = await authenticateFixedLifeAccount(body?.username, body?.password);
    if (!partnerKey) {
      return NextResponse.json({ ok: false, error: "账号或密码不正确" }, { status: 401 });
    }

    const session = createFixedLifeSession(partnerKey);
    const response = NextResponse.json({
      ok: true,
      identity: {
        partnerKey,
        displayName: partnerKey === "cat" ? "猫猫" : "鱼鱼",
      },
    });
    response.cookies.set(LIFE_ACCOUNT_COOKIE, session.token, {
      ...cookieBase,
      maxAge: session.maxAge,
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "登录服务暂时不可用" }, { status: 500 });
  }
}
