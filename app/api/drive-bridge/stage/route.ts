import { NextResponse } from "next/server";
import { verifyDriveBridgeRequest } from "@/lib/server/drive-bridge-auth";
import { createDriveBridgeStagingUpload } from "@/lib/server/drive-bridge-staging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

type StageBody = {
  commandId?: unknown;
  mimeType?: unknown;
  size?: unknown;
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const auth = await verifyDriveBridgeRequest(request, rawBody);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, error: auth.message }, { status: auth.status, headers: NO_STORE });
  }

  let body: StageBody;
  try {
    body = JSON.parse(rawBody) as StageBody;
  } catch {
    return NextResponse.json({ ok: false, code: "BAD_JSON", error: "请求 JSON 不正确" }, { status: 400, headers: NO_STORE });
  }

  try {
    const commandId = typeof body.commandId === "string" ? body.commandId.trim() : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim() : "";
    const size = typeof body.size === "number" ? body.size : Number(body.size);
    const staging = await createDriveBridgeStagingUpload(auth.bridgeId, { commandId, mimeType, size });
    return NextResponse.json({ ok: true, staging }, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: "BRIDGE_STAGE_FAILED", error: error instanceof Error ? error.message : "创建原图暂存通道失败" },
      { status: 400, headers: NO_STORE },
    );
  }
}
