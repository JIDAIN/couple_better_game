import type { MedicineRecord, MedicineWritePayload } from "../life/medicine-service";

const DEFAULT_SUPABASE_URL = "https://bfhntnzngozdqsmgfvjk.supabase.co";
const DEFAULT_SPACE_SLUG = "couple-better-game";

export class MedicineCloudError extends Error {
  constructor(message: string, public readonly errorCode: "SERVER_CONFIG" | "MEDICINE_READ_FAILED" | "MEDICINE_WRITE_FAILED" | "CLOUD_NETWORK_ERROR") { super(message); }
}

function env(name: string) { return process.env[name]?.trim() ?? ""; }
function supabaseUrl() { return env("SUPABASE_URL") || DEFAULT_SUPABASE_URL; }
function secretKey() { return env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY"); }
function spaceSlug() { return env("COUPLE_SPACE_SLUG") || DEFAULT_SPACE_SLUG; }

async function rpc<T>(name: string, body: Record<string, unknown>, op: "read" | "write"): Promise<T> {
  const secret = secretKey();
  if (!secret) throw new MedicineCloudError("Supabase 服务端环境变量未配置完整", "SERVER_CONFIG");
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl()}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  } catch { throw new MedicineCloudError("连接 Supabase 失败", "CLOUD_NETWORK_ERROR"); }
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: string } | null;
    throw new MedicineCloudError(error?.message ?? (op === "read" ? "读取药箱失败" : "保存药品失败"), op === "read" ? "MEDICINE_READ_FAILED" : "MEDICINE_WRITE_FAILED");
  }
  return response.json() as Promise<T>;
}

export function listMedicines() { return rpc<MedicineRecord[]>("list_medicine_items", { p_space_slug: spaceSlug() }, "read"); }
export function createMedicine(payload: MedicineWritePayload) { return rpc<MedicineRecord>("create_medicine_item", { p_payload: payload, p_space_slug: spaceSlug() }, "write"); }
export function updateMedicine(id: string, payload: MedicineWritePayload) { return rpc<MedicineRecord>("update_medicine_item", { p_medicine_id: id, p_payload: payload, p_space_slug: spaceSlug() }, "write"); }
export function deleteMedicine(id: string) { return rpc<MedicineRecord>("delete_medicine_item", { p_medicine_id: id, p_space_slug: spaceSlug() }, "write"); }
