import { NextResponse } from "next/server";
import { isValidSyncPassword } from "@/lib/server/supabase-home-sync";
import { bootstrapFirstLifeMember, resolveLifeAuth } from "@/lib/server/supabase-auth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await resolveLifeAuth(request);
  if (!auth) return NextResponse.json({ ok: false, error: "请先登录" }, { status: 401 });
  if (auth.identity.coupleSpaceId) {
    return NextResponse.json({ ok: false, error: "当前账号已经绑定双人空间" }, { status: 409 });
  }

  const body = (await request.json().catch(() => null)) as {
    migrationPassword?: unknown;
    partnerKey?: unknown;
  } | null;
  const migrationPassword = typeof body?.migrationPassword === "string" ? body.migrationPassword : "";
  const partnerKey = body?.partnerKey === "cat" || body?.partnerKey === "fish" ? body.partnerKey : null;
  if (!isValidSyncPassword(migrationPassword)) {
    return NextResponse.json({ ok: false, error: "旧系统迁移密码不正确" }, { status: 403 });
  }
  if (!partnerKey) return NextResponse.json({ ok: false, error: "请选择自己的身份" }, { status: 400 });

  try {
    const result = await bootstrapFirstLifeMember({ userId: auth.identity.userId, partnerKey });
    return NextResponse.json({ ok: true, identity: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "初始化绑定失败";
    const status = message === "BOOTSTRAP_ALREADY_COMPLETED" ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
