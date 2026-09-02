import type {
  MealQuery,
  MealRecord,
  MealWritePayload,
} from "./meal-service";

type MealListResponse = {
  ok: true;
  meals: MealRecord[];
};

type MealWriteResponse = {
  ok: true;
  meal: MealRecord;
};

type MealErrorResponse = {
  ok?: false;
  error?: string;
  errorCode?: string;
};

export class MealApiError extends Error {
  readonly status: number;
  readonly errorCode: string;

  constructor(message: string, status: number, errorCode = "MEAL_API_ERROR") {
    super(message);
    this.name = "MealApiError";
    this.status = status;
    this.errorCode = errorCode;
  }
}

async function readJson<T>(response: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    if (!response.ok) {
      throw new MealApiError("饮食服务返回了无法识别的响应", response.status);
    }
  }

  if (!response.ok) {
    const errorBody = (body ?? {}) as MealErrorResponse;
    throw new MealApiError(
      errorBody.error ?? "饮食服务暂时不可用",
      response.status,
      errorBody.errorCode ?? "MEAL_API_ERROR",
    );
  }

  return body as T;
}

export async function fetchMeals(query: MealQuery) {
  const params = new URLSearchParams({ date: query.mealDate });
  if (query.partnerKey) params.set("person", query.partnerKey);

  const response = await fetch(`/api/meals?${params.toString()}`, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = await readJson<MealListResponse>(response);
  return body.meals;
}

export async function createMealRecord(payload: MealWritePayload) {
  const response = await fetch("/api/meals", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await readJson<MealWriteResponse>(response);
  return body.meal;
}

export async function updateMealRecord(
  mealId: string,
  payload: MealWritePayload,
) {
  const response = await fetch(`/api/meals/${encodeURIComponent(mealId)}`, {
    method: "PUT",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await readJson<MealWriteResponse>(response);
  return body.meal;
}

export async function deleteMealRecord(mealId: string) {
  const response = await fetch(`/api/meals/${encodeURIComponent(mealId)}`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = await readJson<MealWriteResponse>(response);
  return body.meal;
}

export function mealPhotoUrl(meal: MealRecord) {
  return `/api/meals/${encodeURIComponent(meal.id)}/photo?v=${encodeURIComponent(meal.updatedAt)}`;
}

export async function uploadMealPhoto(mealId: string, file: File) {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch(`/api/meals/${encodeURIComponent(mealId)}/photo`, {
    method: "PUT",
    credentials: "same-origin",
    cache: "no-store",
    body: form,
  });
  const body = await readJson<MealWriteResponse>(response);
  return body.meal;
}

export async function deleteMealPhoto(mealId: string) {
  const response = await fetch(`/api/meals/${encodeURIComponent(mealId)}/photo`, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = await readJson<MealWriteResponse>(response);
  return body.meal;
}
