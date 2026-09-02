import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { availableLifeGames, lifeGameRegistry } from "../../lib/life/game-registry";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("V2 integration boundaries", () => {
  it("keeps the legacy game behind the game machine and routes it to /game", () => {
    const available = availableLifeGames();
    expect(available).toHaveLength(1);
    expect(available[0]?.gameKey).toBe("beauty-slim-game");
    expect(available[0]?.route).toBe("/game");
    expect(lifeGameRegistry.some((game) => game.route === "/game")).toBe(true);

    const mePage = source("components/life/LifeMePage.tsx");
    expect(mePage).toContain('href: "/nest/game-machine"');
    expect(mePage).not.toContain('href: "/game"');
  });

  it("keeps /game mounted on the legacy HomeScreen", () => {
    const gamePage = source("app/game/page.tsx");
    expect(gamePage).toContain('import { HomeScreen }');
    expect(gamePage).toContain("<HomeScreen />");
  });

  it("does not reintroduce detailed meal UI into the legacy game", () => {
    const legacyMealAdapter = source("components/nutrition/DailyMealsPanel.tsx");
    expect(legacyMealAdapter).toContain("return null");
    expect(legacyMealAdapter).not.toContain("DailyMealsPanelCore");
    expect(legacyMealAdapter).not.toContain("meal-client");
    expect(legacyMealAdapter).not.toContain("MealEditorModal");
  });

  it("keeps the new life food route separate from the legacy game", () => {
    const foodPage = source("app/food/page.tsx");
    expect(foodPage).toContain("LifeAppShell");
    expect(foodPage).not.toContain("HomeScreen");
  });

  it("keeps git-triggered Vercel deployment disabled", () => {
    const vercel = JSON.parse(source("vercel.json")) as {
      git?: { deploymentEnabled?: boolean };
    };
    expect(vercel.git?.deploymentEnabled).toBe(false);
  });
});
