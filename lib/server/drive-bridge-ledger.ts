import { createHash } from "node:crypto";

const DEFAULT_SUPABASE_URL = "https://bfhntnzngozdqsmgfvjk.supabase.co";

export type DriveBridgeLedgerRow = {
  command_id: string;
  actor: "cat" | "fish";
  tool: string;
  request_hash: string;
  status: "processing" | "succeeded" | "failed";
  receipt: unknown;
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function supabaseUrl() {
  return env("SUPABASE_URL") || DEFAULT_SUPABASE_URL;
}

function headers(extra?: HeadersInit) {
  const secret = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  return {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
    ...extra,
  };
}

export function driveBridgeRequestHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function readLedger(actor: "cat" | "fish", commandId: string): Promise<DriveBridgeLedgerRow | null> {
  const response = await fetch(
    `${supabaseUrl()}/rest/v1/life_drive_bridge_commands?actor=eq.${actor}&command_id=eq.${encodeURIComponent(commandId)}&select=command_id,actor,tool,request_hash,status,receipt&limit=1`,
    { headers: headers(), cache: "no-store" },
  );
  if (!response.ok) throw new Error("DRIVE_BRIDGE_LEDGER_READ_FAILED");
  const rows = (await response.json()) as DriveBridgeLedgerRow[];
  return rows[0] ?? null;
}

export async function getDriveBridgeCommandLedger(
  actor: "cat" | "fish",
  commandId: string,
): Promise<DriveBridgeLedgerRow | null> {
  return readLedger(actor, commandId);
}

export async function claimDriveBridgeCommand(input: {
  commandId: string;
  actor: "cat" | "fish";
  tool: string;
  requestHash: string;
}) {
  const response = await fetch(`${supabaseUrl()}/rest/v1/life_drive_bridge_commands?on_conflict=actor,command_id`, {
    method: "POST",
    headers: headers({
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=representation",
    }),
    body: JSON.stringify({
      command_id: input.commandId,
      actor: input.actor,
      tool: input.tool,
      request_hash: input.requestHash,
      status: "processing",
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("DRIVE_BRIDGE_LEDGER_CLAIM_FAILED");
  const inserted = (await response.json()) as DriveBridgeLedgerRow[];
  if (inserted.length > 0) return { claimed: true as const, row: inserted[0] };

  const existing = await readLedger(input.actor, input.commandId);
  if (!existing) throw new Error("DRIVE_BRIDGE_LEDGER_MISSING");
  if (existing.tool !== input.tool || existing.request_hash !== input.requestHash) {
    throw new Error("COMMAND_ID_REUSED_WITH_DIFFERENT_PAYLOAD");
  }
  return { claimed: false as const, row: existing };
}

export async function finishDriveBridgeCommand(
  actor: "cat" | "fish",
  commandId: string,
  status: "succeeded" | "failed",
  receipt: unknown,
) {
  const response = await fetch(
    `${supabaseUrl()}/rest/v1/life_drive_bridge_commands?actor=eq.${actor}&command_id=eq.${encodeURIComponent(commandId)}`,
    {
      method: "PATCH",
      headers: headers({ "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify({ status, receipt, updated_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("DRIVE_BRIDGE_LEDGER_FINISH_FAILED");
}
