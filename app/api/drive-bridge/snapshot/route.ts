import { NextResponse } from "next/server";
import { verifyDriveBridgeRequest } from "@/lib/server/drive-bridge-auth";
import { getDriveBridgeSnapshot } from "@/lib/server/drive-bridge-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const rawBody = await request.text();
  const auth = verifyDriveBridgeRequest(request, rawBody);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, error: auth.message }, { status: auth.status, headers: NO_STORE });
  }

  let includeLegacy = false;
  try {
    const parsed = rawBody ? (JSON.parse(rawBody) as { includeLegacy?: unknown }) : {};
    includeLegacy = parsed.includeLegacy === true;
  } catch {
    return NextResponse.json({ ok: false, code: "BAD_JSON", error: "请求 JSON 不正确" }, { status: 400, headers: NO_STORE });
  }

  try {
    const snapshot = await getDriveBridgeSnapshot(auth.identity, includeLegacy);
    return NextResponse.json({ ok: true, snapshot }, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: "BRIDGE_SNAPSHOT_FAILED", error: error instanceof Error ? error.message : "读取 Bridge 快照失败" },
      { status: 502, headers: NO_STORE },
    );
  }
}
