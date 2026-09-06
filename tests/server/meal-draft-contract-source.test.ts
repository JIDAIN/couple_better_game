import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const contract = readFileSync(join(root, "lib/ai/meal-draft-contract.ts"), "utf8");
const executor = readFileSync(join(root, "lib/server/life-agent-executor.ts"), "utf8");
const gateway = readFileSync(join(root, "lib/server/life-ai-gateway.ts"), "utf8");

describe("meal draft confirmation and before/after photo contract", () => {
  it("requires a draft before a new meal can be persisted", () => {
    expect(contract).toContain("先草稿、后确认、再写入");
    expect(contract).toContain("用户第一句话即使说了‘帮我记录/记一下’");
    expect(executor).toContain("assertMealDraftConfirmed");
    expect(executor).toContain("isMealCreateMutation");
    expect(executor).toContain("isMealDraftConfirmationText");
    expect(executor).toContain("MEAL_DRAFT_CONFIRMATION_QUESTION");
  });

  it("supports both single-photo intake estimates and before-after subtraction", () => {
    expect(contract).toContain("单张图片");
    expect(contract).toContain("基本都吃完");
    expect(contract).toContain("吃了一半");
    expect(contract).toContain("两张图片");
    expect(contract).toContain("实际摄入 = 餐前估计量 - 餐后剩余量");
    expect(contract).toContain("骨头、果皮、果核、包装");
    expect(contract).toContain("用户文字说明的优先级最高");
  });

  it("asks the model to estimate a complete nutrition draft before confirmation", () => {
    expect(contract).toContain("estimatedWeightG");
    expect(contract).toContain("caloriesKcal");
    expect(contract).toContain("proteinG");
    expect(contract).toContain("carbsG");
    expect(contract).toContain("fatG");
    expect(contract).toContain("totalCaloriesKcal");
    expect(gateway).toContain("MEAL_DRAFT_AGENT_RULES");
    expect(gateway).toContain("新的 meal 必须遵守下面的饮食草稿确认规则");
  });

  it("accepts short explicit confirmations after the draft", () => {
    expect(contract).toContain('"确认记录"');
    expect(contract).toContain('"没问题"');
    expect(contract).toContain('"可以"');
    expect(contract).toContain('"就这样"');
    expect(contract).toContain('"按这个记"');
  });
});
