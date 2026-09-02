import type { LifePartnerKey } from "./life-service";
import type { WeightRecord, WeightWritePayload } from "./weight-service";

type ErrorBody = { error?: string; errorCode?: string };

export class WeightApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly errorCode?: string) {
    super(message);
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as (T & ErrorBody) | null;
  if (!response.ok) throw new WeightApiError(body?.error ?? "体重服务暂时不可用", response.status, body?.errorCode);
  return body as T;
}

export async function fetchWeights(partnerKey: LifePartnerKey) {
  const response = await fetch(`/api/life/weights?person=${partnerKey}`, { cache: "no-store", credentials: "same-origin" });
  return (await readJson<{ ok: true; weights: WeightRecord[] }>(response)).weights;
}

export async function createWeightRecord(payload: WeightWritePayload) {
  const response = await fetch("/api/life/weights", {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  return (await readJson<{ ok: true; weight: WeightRecord }>(response)).weight;
}

export async function updateWeightRecord(id: string, payload: WeightWritePayload) {
  const response = await fetch(`/api/life/weights/${encodeURIComponent(id)}`, {
    method: "PUT", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  return (await readJson<{ ok: true; weight: WeightRecord }>(response)).weight;
}

export async function deleteWeightRecord(id: string) {
  const response = await fetch(`/api/life/weights/${encodeURIComponent(id)}`, {
    method: "DELETE", credentials: "same-origin", cache: "no-store",
  });
  return (await readJson<{ ok: true; weight: WeightRecord }>(response)).weight;
}
