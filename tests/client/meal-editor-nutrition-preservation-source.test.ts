import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const editor = readFileSync(join(root, "components/life/LifeMealEditorPage.tsx"), "utf8");

describe("meal editor nutrition preservation", () => {
  it("round-trips AI item identity, weight and calorie estimate metadata", () => {
    expect(editor).toContain("foodId: item.foodId");
    expect(editor).toContain("displayName: item.displayName");
    expect(editor).toContain("estimatedWeightG: item.estimatedWeightG");
    expect(editor).toContain("calorieMinKcal: item.calorieMinKcal");
    expect(editor).toContain("calorieMaxKcal: item.calorieMaxKcal");
    expect(editor).toContain("foodId: item.foodId, rawName: item.rawName.trim(), displayName:");
    expect(editor).toContain("estimatedWeightG: weight");
  });

  it("preserves meal-level AI calorie estimates when unrelated fields are edited", () => {
    expect(editor).toContain("calorieDataTouched");
    expect(editor).toContain("!calorieDataTouched ? meal?.totalCaloriesKcal ?? null : null");
    expect(editor).toContain("!calorieDataTouched ? meal?.calorieMinKcal ?? null : null");
    expect(editor).toContain("!calorieDataTouched ? meal?.calorieMaxKcal ?? null : null");
  });

  it("lets users edit estimated weight instead of silently resetting it to null", () => {
    expect(editor).toContain("估计重量 g（可选）");
    expect(editor).not.toContain("estimatedWeightG: null, caloriesKcal");
  });
});
