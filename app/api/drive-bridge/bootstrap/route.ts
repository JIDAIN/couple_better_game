import { NextResponse } from "next/server";
import {
  DriveBridgePairingError,
  pairDriveBridgeWorker,
  parseDriveBridgePairingPayload,
} from "@/lib/server/drive-bridge-pairing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "BAD_JSON", error: "请求 JSON 不正确" },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const parsed = parseDriveBridgePairingPayload(payload);
    const config = await pairDriveBridgeWorker(parsed);
    return NextResponse.json({ ok: true, config }, { headers: NO_STORE });
  } catch (error) {
    const code = error instanceof DriveBridgePairingError ? error.message : "PAIRING_FAILED";
    const status = code === "PAIRING_SERVICE_UNAVAILABLE" ? 503 : 400;
    return NextResponse.json(
      { ok: false, code, error: "Worker 配对失败；请确认当前 Bridge Sheet 与一次性配对码有效" },
      { status, headers: NO_STORE },
    );
  }
}
