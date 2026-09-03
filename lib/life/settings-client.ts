import { normalizeLifeSettings, type LifeSettings, type LifeSettingsPatch } from "./settings-service";

export class LifeSettingsApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

type ApiError = { error?: string };

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new LifeSettingsApiError(body?.error ?? "读取生活设置失败", response.status);
  }
  return (await response.json()) as T;
}

export async function fetchLifeSettings(): Promise<LifeSettings> {
  const result = await requestJson<{ ok: true; settings: unknown }>("/api/life/settings");
  return normalizeLifeSettings(result.settings);
}

export async function patchLifeSettings(patch: LifeSettingsPatch): Promise<LifeSettings> {
  const result = await requestJson<{ ok: true; settings: unknown }>("/api/life/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return normalizeLifeSettings(result.settings);
}
