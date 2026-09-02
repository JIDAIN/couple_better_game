const DEFAULT_SUPABASE_URL = "https://bfhntnzngozdqsmgfvjk.supabase.co";

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function supabaseUrl() {
  return env("SUPABASE_URL") || DEFAULT_SUPABASE_URL;
}

function secretKey() {
  return env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
}

async function ownerValue(table: string, id: string, column: string) {
  const key = secretKey();
  if (!key) throw new Error("Supabase 服务端密钥未配置");
  const response = await fetch(`${supabaseUrl()}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=${column}&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("读取记录归属失败");
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  const value = rows[0]?.[column];
  return typeof value === "string" ? value : null;
}

export function mealOwnerKey(id: string) {
  return ownerValue("meals", id, "partner_key");
}

export function weightOwnerKey(id: string) {
  return ownerValue("weight_measurements", id, "partner_key");
}

export function mailboxSenderKey(id: string) {
  return ownerValue("mailbox_letters", id, "sender_key");
}
