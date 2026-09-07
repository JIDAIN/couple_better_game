import type {
  MailboxLetter,
  MailboxStatus,
  MailboxWritePayload,
} from "./mailbox-service";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "小信箱请求失败");
  }
  return response.json() as Promise<T>;
}

export async function fetchMailboxLetters() {
  return (await request<{ ok: true; letters: MailboxLetter[] }>("/api/life/mailbox")).letters;
}

export async function createMailboxItem(
  payload: MailboxWritePayload,
  status: MailboxStatus,
) {
  return (
    await request<{ ok: true; letter: MailboxLetter }>("/api/life/mailbox", {
      method: "POST",
      body: JSON.stringify({ ...payload, status }),
    })
  ).letter;
}

export async function updateMailboxItem(id: string, payload: MailboxWritePayload) {
  return (
    await request<{ ok: true; letter: MailboxLetter }>(
      `/api/life/mailbox/${encodeURIComponent(id)}`,
      { method: "PUT", body: JSON.stringify(payload) },
    )
  ).letter;
}

export async function sendMailboxItem(id: string) {
  return (
    await request<{ ok: true; letter: MailboxLetter }>(
      `/api/life/mailbox/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ action: "send" }) },
    )
  ).letter;
}

export async function deleteMailboxItem(id: string) {
  return request(`/api/life/mailbox/${encodeURIComponent(id)}`, { method: "DELETE" });
}
