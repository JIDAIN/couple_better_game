import type { MailboxLetter, MailboxWritePayload } from "../life/mailbox-service";

const DEFAULT_SUPABASE_URL = "https://bfhntnzngozdqsmgfvjk.supabase.co";
const DEFAULT_SPACE_SLUG = "couple-better-game";

type RpcErrorBody = { message?: string };
export class MailboxCloudError extends Error {
  constructor(message: string, public readonly errorCode: "SERVER_CONFIG" | "MAILBOX_READ_FAILED" | "MAILBOX_WRITE_FAILED" | "CLOUD_NETWORK_ERROR") { super(message); }
}
function env(name: string) { return process.env[name]?.trim() ?? ""; }
function supabaseUrl() { return env("SUPABASE_URL") || DEFAULT_SUPABASE_URL; }
function supabaseSecretKey() { return env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY"); }
function coupleSpaceSlug() { return env("COUPLE_SPACE_SLUG") || DEFAULT_SPACE_SLUG; }
async function callRpc<T>(name: string, body: Record<string, unknown>, operation: "read" | "write"): Promise<T> {
  const secret = supabaseSecretKey();
  if (!supabaseUrl() || !secret) throw new MailboxCloudError("Supabase 服务端环境变量未配置完整", "SERVER_CONFIG");
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl()}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  } catch { throw new MailboxCloudError("连接 Supabase 失败", "CLOUD_NETWORK_ERROR"); }
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as RpcErrorBody | null;
    throw new MailboxCloudError(error?.message ?? (operation === "read" ? "读取小信箱失败" : "写入小信箱失败"), operation === "read" ? "MAILBOX_READ_FAILED" : "MAILBOX_WRITE_FAILED");
  }
  return (await response.json()) as T;
}
export function listMailboxLetters() { return callRpc<MailboxLetter[]>("list_mailbox_letters", { p_space_slug: coupleSpaceSlug() }, "read"); }
export function createMailboxLetter(payload: MailboxWritePayload) { return callRpc<MailboxLetter>("create_mailbox_letter", { p_payload: payload, p_space_slug: coupleSpaceSlug() }, "write"); }
export function updateMailboxLetter(id: string, payload: MailboxWritePayload) { return callRpc<MailboxLetter>("update_mailbox_letter", { p_letter_id: id, p_payload: payload, p_space_slug: coupleSpaceSlug() }, "write"); }
export function deleteMailboxLetter(id: string) { return callRpc<MailboxLetter>("delete_mailbox_letter", { p_letter_id: id, p_space_slug: coupleSpaceSlug() }, "write"); }
