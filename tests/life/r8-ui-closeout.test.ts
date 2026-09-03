import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("R8.2 visual and interaction closeout", () => {
  it("shows shared anniversary day count with the heart at the end and edits it from Nest", () => {
    const today = source("components/life/TodayLifePage.tsx");
    const nest = source("components/life/LifeNestPage.tsx");
    const settingsRoute = source("app/api/life/settings/route.ts");
    expect(today).toContain("daysTogether");
    expect(today).toContain("life-together-heart");
    expect(today.indexOf("一起度过的第")).toBeLessThan(today.indexOf("life-together-heart"));
    expect(nest).toContain("我们的纪念日");
    expect(nest).toContain("patchLifeSettings({ anniversaryDate");
    expect(settingsRoute).toContain("resolveFixedLifeIdentity");
  });

  it("uses genuinely compact framed home actions and 编辑 after saving", () => {
    const mood = source("components/life/today/TodayMoodCard.tsx");
    const sleep = source("components/life/today/TodaySleepCard.tsx");
    const css = source("app/r8-2-ui-calibration.css");
    expect(mood).toContain('myMood ? "编辑" : "+ 记录"');
    expect(sleep).toContain('mySleep ? "编辑" : "+ 记录"');
    expect(mood).toContain('className="life-card-action"');
    expect(sleep).toContain('className="life-card-action"');
    expect(css).toContain(".life-card-action");
    expect(css).toContain("height: 1.95rem");
    expect(css).toContain("border-radius: 13px");
  });

  it("makes eight hours a full sleep ring and caps longer sleep", () => {
    const sleep = source("components/life/today/TodaySleepCard.tsx");
    expect(sleep).toContain("const FULL_SLEEP_MINUTES = 8 * 60");
    expect(sleep).toContain("Math.min(1, minutes / FULL_SLEEP_MINUTES)");
    expect(sleep).toContain("conic-gradient");
  });

  it("makes mood icons large and frameless and closes immediately when chosen", () => {
    const mood = source("components/life/today/TodayMoodCard.tsx");
    const css = source("app/r8-2-ui-calibration.css");
    const closeIndex = mood.indexOf("setPickerOpen(false)");
    const saveIndex = mood.indexOf("await saveMood");
    expect(closeIndex).toBeGreaterThan(-1);
    expect(closeIndex).toBeLessThan(saveIndex);
    expect(mood).not.toContain('className={`life-mood-choice ${active');
    expect(css).toContain("width: 3.75rem !important");
    expect(css).toContain("background: transparent !important");
    expect(css).toContain("box-shadow: none !important");
  });

  it("uses a Notion-style activity icon picker instead of a fixed category strip", () => {
    const activity = source("components/life/today/TodayActivityCard.tsx");
    for (const label of ["散步", "学习", "运动", "约会", "电影", "桌游", "旅行", "做饭", "购物", "家务", "阅读", "骑行", "展览"]) {
      expect(activity).toContain(label);
    }
    expect(activity).toContain("function ActivityIconPicker");
    expect(activity).toContain('useState<ActivityIconKey>("other")');
    expect(activity).toContain("life-activity-leading-icon");
    expect(activity).toContain("life-activity-icon-popover");
    expect(activity).not.toContain("life-activity-icon-choice");
    expect(activity).toContain("setRecords((current) => [saved");
    expect(activity).toContain("updateActivityEntry");
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

  it("uses consistent SVG Nest art and a dedicated chevron column", () => {
    const nest = source("components/life/LifeNestPage.tsx");
    const css = source("app/r8-2-ui-calibration.css");
    expect(nest).toContain("NestFeatureIcon");
    expect(nest).toContain("life-nest-tile-copy");
    expect(nest).toContain("<svg");
    expect(css).toContain("grid-template-columns: minmax(0,1fr) 1.25rem");
    expect(css).toContain("position: static !important");
    expect(nest).not.toContain('icon: "⚖️"');
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

  it("keeps mailbox structure but gives equal compact journal-style paper previews", () => {
    const mailbox = source("components/life/LifeMailboxPage.tsx");
    const css = source("app/r8-2-ui-calibration.css");
    const mailboxCss = source("app/r8-2-mailbox.css");
    expect(mailbox).toContain('type FormatFilter = "all" | MailboxFormat');
    expect(mailbox).toContain("THEMES");
    expect(mailbox).toContain("form.title");
    expect(mailbox).toContain("firstSentence(letter.body)");
    expect(mailbox).toContain("setReading(letter)");
    expect(css).toContain("height: 9.1rem !important");
    expect(mailboxCss).toContain('font-family: ui-serif, "Songti SC"');
    expect(mailboxCss).toContain("box-shadow: none !important");
  });

  it("connects My to real backup export import and transactional restore", () => {
    const me = source("components/life/LifeMePage.tsx");
    const page = source("components/life/LifeDataManagementPage.tsx");
    const route = source("app/api/life/data-management/route.ts");
    const server = source("lib/server/life-data-management.ts");
    const migration = source("supabase/migrations/20260903194500_r8_2_full_data_management.sql");
    expect(me).toContain('href="/me/data"');
    expect(page).toContain("立即备份");
    expect(page).toContain("导出 JSON");
    expect(page).toContain("导入 JSON");
    expect(page).toContain("恢复点");
    expect(route).toContain('const RESTORE_CONFIRMATION = "确认恢复生活数据"');
    expect(server).toContain("create_life_backup_snapshot");
    expect(server).toContain("list_life_backup_snapshots");
    expect(server).toContain("restore_life_backup_snapshot");
    expect(server).toContain("import_life_full_data");
    expect(migration).toContain("restore_life_backup_snapshot");
    expect(migration).toContain("pre_restore");
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