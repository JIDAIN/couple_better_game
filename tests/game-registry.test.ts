import { describe, expect, it } from "vitest";
import { availableLifeGames, lifeGameRegistry } from "../lib/life/game-registry";

describe("life game registry", () => {
  it("keeps the legacy game as the only currently available entry", () => {
    const available = availableLifeGames();
    expect(available).toHaveLength(1);
    expect(available[0]?.gameKey).toBe("beauty-slim-game");
    expect(available[0]?.route).toBe("/game");
  });

  it("keeps registry keys unique", () => {
    const keys = lifeGameRegistry.map((game) => game.gameKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
