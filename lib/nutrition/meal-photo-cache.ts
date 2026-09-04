import { mealPhotoUrl } from "./meal-client";
import type { MealRecord } from "./meal-service";

const inflight = new Map<string, Promise<void>>();
const loaded = new Set<string>();

function preloadImage(src: string, timeoutMs = 1800) {
  if (typeof window === "undefined" || loaded.has(src)) return Promise.resolve();
  const existing = inflight.get(src);
  if (existing) return existing;

  const task = new Promise<void>((resolve) => {
    const image = new window.Image();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      loaded.add(src);
      inflight.delete(src);
      resolve();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    image.onload = () => { window.clearTimeout(timer); finish(); };
    image.onerror = () => { window.clearTimeout(timer); finish(); };
    image.decoding = "async";
    image.src = src;
    if (image.complete) {
      window.clearTimeout(timer);
      finish();
    }
  });

  inflight.set(src, task);
  return task;
}

export async function preloadMealPhotos(meals: MealRecord[], timeoutMs = 1800) {
  const urls = Array.from(new Set(
    meals.filter((meal) => meal.photoPath && !meal.deletedAt).map(mealPhotoUrl),
  ));
  await Promise.allSettled(urls.map((url) => preloadImage(url, timeoutMs)));
}

export function mealPhotoUrls(meals: MealRecord[]) {
  return Array.from(new Set(
    meals.filter((meal) => meal.photoPath && !meal.deletedAt).map(mealPhotoUrl),
  ));
}
