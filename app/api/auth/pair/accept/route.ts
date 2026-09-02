import { NextResponse } from "next/server";
import { callLifeAuthRpc, getLifeIdentity, readLifeAccessToken } from "@/lib/server/life-auth";

export async function POST(request: Request) {
  try {
    const accessToken = readLifeAccessToken(request);
    if (!accessToken) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
    const body = (await request.json()) as { code?: string };
    const code = body.code?.trim().toUpperCase() ?? "";
    if (!code) return NextResponse.json({ ok: false, error: "请输入邀请码" }, { status: 400 });
    await callLifeAuthRpc(accessToken, "accept_couple_space_invite", { p_code: code });
    return NextResponse.json({ ok: true, identity: await getLifeIdentity(accessToken) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "加入失败" }, { status: 400 });
  }
}
