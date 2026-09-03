import type { MealRecord } from "@/lib/nutrition/meal-service";

type MacroKey = "carbs" | "protein" | "fat";
type MacroSummary = { key: MacroKey; label: string; grams: number; kcal: number; known: boolean; color: string };

function summarize(meals: MealRecord[]) {
  let calories = 0;
  let knownCalories = 0;
  let carbs = 0;
  let protein = 0;
  let fat = 0;
  let hasCarbs = false;
  let hasProtein = false;
  let hasFat = false;

  meals.forEach((meal) => {
    if (meal.totalCaloriesKcal != null) { calories += meal.totalCaloriesKcal; knownCalories += 1; }
    meal.items.forEach((item) => {
      if (item.carbsG != null) { carbs += item.carbsG; hasCarbs = true; }
      if (item.proteinG != null) { protein += item.proteinG; hasProtein = true; }
      if (item.fatG != null) { fat += item.fatG; hasFat = true; }
    });
  });

  const macros: MacroSummary[] = [
    { key: "carbs", label: "碳水", grams: carbs, kcal: carbs * 4, known: hasCarbs, color: "var(--life-yellow)" },
    { key: "protein", label: "蛋白质", grams: protein, kcal: protein * 4, known: hasProtein, color: "var(--life-mint-strong)" },
    { key: "fat", label: "脂肪", grams: fat, kcal: fat * 9, known: hasFat, color: "var(--life-pink)" },
  ];
  const macroCalories = macros.filter((macro) => macro.known).reduce((sum, item) => sum + item.kcal, 0);
  return { calories, caloriesComplete: meals.length > 0 && knownCalories === meals.length, macros, knownMacros: macros.some((macro) => macro.known), macroCalories };
}

function donutBackground(macros: MacroSummary[], total: number) {
  if (total <= 0) return "conic-gradient(var(--life-border-soft) 0deg 360deg)";
  let cursor = 0;
  const parts: string[] = [];
  macros.filter((macro) => macro.known).forEach((macro) => {
    const start = cursor;
    cursor += (macro.kcal / total) * 360;
    parts.push(`${macro.color} ${start.toFixed(2)}deg ${cursor.toFixed(2)}deg`);
  });
  return `conic-gradient(${parts.join(", ")})`;
}

export function DailyNutritionSummary({ meals, label }: { meals: MealRecord[]; label?: string }) {
  const summary = summarize(meals);
  const hasMeals = meals.length > 0;
  const calorieText = !hasMeals ? "—" : summary.caloriesComplete ? `${Math.round(summary.calories)} kcal` : summary.calories > 0 ? `已知 ${Math.round(summary.calories)} kcal` : "未估算";

  return (
    <section className="life-daily-nutrition-summary">
      <div className="life-daily-nutrition-head">
        <div><p className="life-daily-nutrition-kicker">{label ? `${label} · ` : ""}当日汇总</p><strong>{calorieText}</strong></div>
        <div className="life-daily-nutrition-donut" style={{ background: donutBackground(summary.macros, summary.macroCalories) }} aria-label="三大营养素热量占比"><span>{summary.knownMacros ? "占比" : "—"}</span></div>
      </div>
      <div className="life-daily-nutrition-legend">
        {summary.macros.map((macro) => {
          const percent = macro.known && summary.macroCalories > 0 ? Math.round((macro.kcal / summary.macroCalories) * 100) : null;
          return <div key={macro.key} className="life-daily-nutrition-item"><span className="life-daily-nutrition-dot" style={{ background: macro.color }} aria-hidden /><span>{macro.label}</span><strong>{macro.known ? `${macro.grams.toFixed(1)}g` : "—"}</strong><small>{percent == null ? "" : `${percent}%`}</small></div>;
        })}
      </div>
    </section>
  );
}
