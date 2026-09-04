import { createHmac, timingSafeEqual } from "node:crypto";
import {
  getDriveBridgeConfig,
  type DriveBridgeId,
  type DriveBridgeRuntimeConfig,
} from "./drive-bridge-config";

const PROJECT_KICK_PURPOSE = "harbor-project-kick-v1";
const COMMAND_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isDriveProjectKickCommandId(value: string) {
  return COMMAND_ID_PATTERN.test(value);
}

export function buildDriveProjectKickToken(watchToken: string) {
  return createHmac("sha256", watchToken)
    .update(PROJECT_KICK_PURPOSE)
    .digest("base64url");
}

export async function verifyDriveProjectKickToken(
  bridgeId: DriveBridgeId,
  supplied: string,
): Promise<
  | { ok: true; bridgeId: DriveBridgeId; config: DriveBridgeRuntimeConfig }
  | { ok: false }
> {
  if (!supplied) return { ok: false };
  let config: DriveBridgeRuntimeConfig | null;
  try {
    config = await getDriveBridgeConfig(bridgeId);
  } catch {
    return { ok: false };
  }
  if (!config?.watchToken) return { ok: false };
  const expected = buildDriveProjectKickToken(config.watchToken);
  if (!safeEqual(supplied, expected)) return { ok: false };
  return { ok: true, bridgeId, config };
}
