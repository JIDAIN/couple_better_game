import { NextResponse } from "next/server";
import { callLifeAuthRpc, getLifeIdentity, readLifeAccessToken } from "@/lib/server/life-auth";

export async function POST(request: Request) {
  try {
    const accessToken = readLifeAccessToken(request);
    if (!accessToken) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
    const body = (await request.json()) as { partnerKey?: "cat" | "fish" };
    if (body.partnerKey !== "cat" && body.partnerKey !== "fish") {
      return NextResponse.json({ ok: false, error: "请选择自己的身份" }, { status: 400 });
    }
    await callLifeAuthRpc(accessToken, "bootstrap_couple_space_membership", { p_partner_key: body.partnerKey });
    return NextResponse.json({ ok: true, identity: await getLifeIdentity(accessToken) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "绑定失败" }, { status: 400 });
  }
}
