import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("R8.1 UI closeout", () => {
  it("shows shared anniversary day count and edits it from Nest", () => {
    const today = source("components/life/TodayLifePage.tsx");
    const nest = source("components/life/LifeNestPage.tsx");
    const settingsRoute = source("app/api/life/settings/route.ts");
    expect(today).toContain("daysTogether");
    expect(today).toContain("一起度过的第 {togetherDay} 天");
    expect(nest).toContain("我们的纪念日");
    expect(nest).toContain("patchLifeSettings({ anniversaryDate");
    expect(settingsRoute).toContain("resolveFixedLifeIdentity");
  });

  it("keeps home actions pill-shaped and mood/sleep use 编辑 after saving", () => {
    const mood = source("components/life/today/TodayMoodCard.tsx");
    const sleep = source("components/life/today/TodaySleepCard.tsx");
    const css = source("app/r8-ui-closeout.css");
    expect(mood).toContain('myMood ? "编辑" : "+ 记录"');
    expect(sleep).toContain('mySleep ? "编辑" : "+ 记录"');
    expect(css).toContain(".life-home-action-pill");
    expect(css).toContain("border-radius: 999px");
  });

  it("makes eight hours a full sleep ring and caps longer sleep", () => {
    const sleep = source("components/life/today/TodaySleepCard.tsx");
    expect(sleep).toContain("const FULL_SLEEP_MINUTES = 8 * 60");
    expect(sleep).toContain("Math.min(1, minutes / FULL_SLEEP_MINUTES)");
    expect(sleep).toContain("conic-gradient");
  });

  it("separates activity add and edit while offering many activity icons", () => {
    const activity = source("components/life/today/TodayActivityCard.tsx");
    for (const label of ["散步", "学习", "运动", "约会", "电影", "桌游", "旅行", "做饭", "购物", "家务"]) {
      expect(activity).toContain(label);
    }
    expect(activity).toContain("const [addOpen");
    expect(activity).toContain("const [editMode");
    expect(activity).toContain("setRecords((current) => [saved");
    expect(activity).toContain("updateActivityEntry");
    expect(activity).toContain('editMode ? "完成编辑" : "编辑"');
  });

  it("uses compact meal photo and macros and removes duplicate daily summary", () => {
    const food = source("components/life/LifeFoodPage.tsx");
    const editor = source("components/life/LifeMealEditorPage.tsx");
    expect(food).not.toContain("今日摄入统计");
    expect(editor).toContain("grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]");
    expect(editor).toContain("＋ 上传照片");
    expect(editor).toContain('label="蛋白质"');
    expect(editor).toContain('label="脂肪"');
    expect(editor).toContain('label="碳水"');
    expect(editor).not.toContain('className="life-back-link"');
  });

  it("reuses Today cards for a historical calendar day", () => {
    const calendarDay = source("components/life/LifeCalendarDayPage.tsx");
    expect(calendarDay).toContain("TodayMoodCard");
    expect(calendarDay).toContain("TodaySleepCard");
    expect(calendarDay).toContain("TodayActivityCard");
    expect(calendarDay).toContain("readOnly");
  });

  it("uses large Nest art with descriptions and chevrons instead of 打开", () => {
    const nest = source("components/life/LifeNestPage.tsx");
    const css = source("app/r8-ui-closeout.css");
    expect(nest).toContain("life-nest-tile-art");
    expect(nest).toContain("life-nest-tile-chevron");
    expect(nest).not.toContain("打开 →");
    expect(css).toContain("width: 4.5rem");
  });

  it("records exact weight time and charts daily averages by period and year", () => {
    const weight = source("components/life/LifeWeightPage.tsx");
    expect(weight).toContain('label: "周"');
    expect(weight).toContain('label: "月"');
    expect(weight).toContain('label: "季度"');
    expect(weight).toContain('label: "年"');
    expect(weight).toContain('useState<Period>("month")');
    expect(weight).toContain("function dailyAverages");
    expect(weight).toContain("measuredAtFrom(date, time)");
    expect(weight).toContain("较上次");
    expect(weight).toContain("目标体重");
    expect(weight).not.toContain("AppTextarea");
    expect(weight).toContain("life-weight-year-nav");
  });

  it("gives mailbox titles themes type filtering equal previews and a full reader", () => {
    const mailbox = source("components/life/LifeMailboxPage.tsx");
    const css = source("app/r8-ui-closeout.css");
    expect(mailbox).toContain('type FormatFilter = "all" | MailboxFormat');
    expect(mailbox).toContain("THEMES");
    expect(mailbox).toContain("form.title");
    expect(mailbox).toContain("firstSentence(letter.body)");
    expect(mailbox).toContain("setReading(letter)");
    expect(css).toContain(".life-letter-preview");
    expect(css).toContain("height: 11rem");
  });

  it("renders medicines as a compact quantity/status/expiry list", () => {
    const medicine = source("components/life/LifeMedicinePage.tsx");
    const css = source("app/r8-ui-closeout.css");
    expect(medicine).toContain("life-medicine-list");
    expect(medicine).toContain("life-medicine-quantity");
    expect(medicine).toContain("最终失效");
    expect(css).toContain(".life-medicine-row");
    expect(css).toContain("min-height: 4.8rem");
  });
});
