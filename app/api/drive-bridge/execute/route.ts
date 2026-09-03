import { NextResponse } from "next/server";
import { verifyDriveBridgeRequest } from "@/lib/server/drive-bridge-auth";
import { executeDriveBridgeBatch } from "@/lib/server/drive-bridge-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const rawBody = await request.text();
  const auth = verifyDriveBridgeRequest(request, rawBody);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, error: auth.message }, { status: auth.status, headers: NO_STORE });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, code: "BAD_JSON", error: "请求 JSON 不正确" }, { status: 400, headers: NO_STORE });
  }

  try {
    const receipts = await executeDriveBridgeBatch(auth.identity, payload);
    return NextResponse.json({ ok: true, receipts }, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: "BRIDGE_EXECUTE_FAILED", error: error instanceof Error ? error.message : "Drive Bridge 执行失败" },
      { status: 400, headers: NO_STORE },
    );
  }
}
