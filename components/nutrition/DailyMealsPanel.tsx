"use client";

/**
 * Legacy-game compatibility boundary.
 *
 * The old 变美变瘦大作战 intentionally stays on the long-lived pre-meal-journal UI.
 * Detailed breakfast/lunch/dinner/snack records now belong only to the V2 /food flow.
 * Keeping this adapter as a no-op lets HomeScreen retain its stable structure without
 * reintroducing the newer meal CRUD / ChatGPT meal UI into /game.
 */
export function DailyMealsPanel() {
  return null;
}
