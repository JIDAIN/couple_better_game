import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const registryPath = new URL("../../lib/server/life-agent-registry.ts", import.meta.url);
const normalizerPath = new URL("../../lib/ai/life-input-normalizer.ts", import.meta.url);

describe("R11.3 AI Access Core hardening source contract", () => {
  it("makes day a person-aware full bundle and exposes first-class mood/sleep/activity queries", async () => {
    const source = await readFile(registryPath, "utf8");
    expect(source).toContain('case "day":');
    expect(source).toContain('case "mood":');
    expect(source).toContain('case "sleep":');
    expect(source).toContain('case "activity":');
    expect(source).toContain("filterDayForPerson(await getLifeDay(date), person)");
    expect(source).toContain("const meals = await listMeals({ mealDate: date, partnerKey: person })");
    expect(source).toContain("return { ...day, meals }");
  });

  it("filters weight by explicit date/range rather than making the model filter history", async () => {
    const source = await readFile(registryPath, "utf8");
    expect(source).toContain("row.measurementDate === date");
    expect(source).toContain("row.measurementDate >= dateFrom");
    expect(source).toContain("row.measurementDate <= dateTo");
  });

  it("uses semantic retry idempotency for create mutations", async () => {
    const source = await readFile(registryPath, "utf8");
    expect(source).toContain('createHash("sha256")');
    expect(source).toContain("tenMinuteWindow");
    expect(source).toContain('idempotencyKey("activity", context, date, data, action === "create")');
    expect(source).toContain('idempotencyKey("meal", context, date, data, action === "create")');
  });

  it("rejects explicit Ta targeting for personal writes and makes activity scope explicit", async () => {
    const source = await readFile(registryPath, "utf8");
    const normalizer = await readFile(normalizerPath, "utf8");
    expect(source).toContain("个人数据只能写入当前 OAuth 账号，不能指定 Ta");
    expect(normalizer).toContain('data.participantScope = context.actor');
    expect(normalizer).toContain('data.participantScope = "both"');
    expect(normalizer).toContain("个人活动不能以当前账号替 Ta 写入");
  });
});
