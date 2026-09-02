import { NextResponse } from "next/server";
import { callLifeAuthRpc, getLifeIdentity, readLifeAccessToken } from "@/lib/server/life-auth";

export async function POST(request: Request) {
  try {
    const accessToken = readLifeAccessToken(request);
    if (!accessToken) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
    const identity = await getLifeIdentity(accessToken);
    if (!identity?.partnerKey) return NextResponse.json({ ok: false, error: "请先完成自己的身份绑定" }, { status: 400 });
    const invitedPartnerKey = identity.partnerKey === "cat" ? "fish" : "cat";
    const invite = await callLifeAuthRpc<{ code: string; partnerKey: string; expiresAt: string }>(
      accessToken,
      "create_couple_space_invite",
      { p_partner_key: invitedPartnerKey },
    );
    return NextResponse.json({ ok: true, invite });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "生成邀请码失败" }, { status: 400 });
  }
}
