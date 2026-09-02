import type { MedicineRecord, MedicineWritePayload } from "./medicine-service";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "药箱请求失败");
  }
  return response.json() as Promise<T>;
}
export async function fetchMedicines() { return (await request<{ ok: true; medicines: MedicineRecord[] }>("/api/life/medicines")).medicines; }
export async function createMedicineItem(payload: MedicineWritePayload) { return (await request<{ ok: true; medicine: MedicineRecord }>("/api/life/medicines", { method: "POST", body: JSON.stringify(payload) })).medicine; }
export async function updateMedicineItem(id: string, payload: MedicineWritePayload) { return (await request<{ ok: true; medicine: MedicineRecord }>(`/api/life/medicines/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) })).medicine; }
export async function deleteMedicineItem(id: string) { return request(`/api/life/medicines/${encodeURIComponent(id)}`, { method: "DELETE" }); }
