import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("R8.3 visual polish and interaction closeout", () => {
  it("keeps the together-day line warm and puts the heart at the end", () => {
    const today = source("components/life/TodayLifePage.tsx");
    const css = source("app/r8-3-visual-polish.css");
    expect(today).toContain("daysTogether");
    expect(today).toContain("life-together-heart");
    expect(today.indexOf("一起度过的第")).toBeLessThan(today.indexOf("life-together-heart"));
    expect(css).toContain(".life-together-days strong");
    expect(css).toContain("color: inherit !important");
    expect(css).toContain("#d99aaa");
  });

  it("uses compact framed Today actions without explanatory subtitles", () => {
    const mood = source("components/life/today/TodayMoodCard.tsx");
    const sleep = source("components/life/today/TodaySleepCard.tsx");
    const activity = source("components/life/today/TodayActivityCard.tsx");
    expect(mood).toContain('myMood ? "编辑" : "+ 记录"');
    expect(sleep).toContain('mySleep ? "编辑" : "+ 记录"');
    expect(mood).not.toContain("各自记录，彼此看见");
    expect(sleep).not.toContain("8 小时为满环");
    expect(activity).not.toContain("今天一起做过的事");
    expect(activity).toContain("普通的一天，也值得被记住");
  });

  it("uses eight hours as full sleep and one identical ring tone for both people", () => {
    const sleep = source("components/life/today/TodaySleepCard.tsx");
    expect(sleep).toContain("const FULL_SLEEP_MINUTES = 8 * 60");
    expect(sleep).toContain("Math.min(1, minutes / FULL_SLEEP_MINUTES)");
    expect(sleep).toContain('const SLEEP_RING_TONE = "var(--life-mint-strong)"');
    expect(sleep).not.toContain('tone="var(--life-blue)"');
    expect(sleep).not.toContain('tone="var(--life-teal)"');
  });

  it("keeps Me and Ta mood cards visually equal and closes picker on selection", () => {
    const mood = source("components/life/today/TodayMoodCard.tsx");
    const css = source("app/r8-3-visual-polish.css");
    const closeIndex = mood.indexOf("setPickerOpen(false)");
    const saveIndex = mood.indexOf("await saveMood");
    expect(closeIndex).toBeGreaterThan(-1);
    expect(closeIndex).toBeLessThan(saveIndex);
    expect(mood).not.toContain("emphasized");
    expect(mood).not.toContain("is-me");
    expect(css).toContain(".life-person-state.is-me");
    expect(css).toContain("background: var(--life-surface) !important");
  });

  it("keeps the Notion-style activity icon popover and removes how-it-works copy", () => {
    const activity = source("components/life/today/TodayActivityCard.tsx");
    for (const label of ["散步", "学习", "运动", "约会", "电影", "桌游", "旅行", "做饭", "购物", "家务", "阅读", "骑行", "展览"]) expect(activity).toContain(label);
    expect(activity).toContain("ActivityIconPicker");
    expect(activity).toContain('useState<ActivityIconKey>("other")');
    expect(activity).toContain("life-activity-icon-popover");
    expect(activity).toContain("setRecords((current) => [saved");
    expect(activity).not.toContain("默认使用小叶子");
  });

  it("adds a reusable daily nutrition summary to Food and historical Calendar Day", () => {
    const summary = source("components/life/DailyNutritionSummary.tsx");
    const food = source("components/life/LifeFoodPage.tsx");
    const calendar = source("components/life/LifeCalendarDayPage.tsx");
    expect(summary).toContain("三大营养素热量占比");
    expect(summary).toContain("carbs * 4");
    expect(summary).toContain("protein * 4");
    expect(summary).toContain("fat * 9");
    expect(food).toContain("<DailyNutritionSummary meals={meals}");
    expect(calendar).toContain("<DailyNutritionSummary meals={meals} label={person.label}");
  });

  it("uses pencil icons for existing meal editing and keeps add actions textual", () => {
    const food = source("components/life/LifeFoodPage.tsx");
    expect(food).toContain("function PencilIcon");
    expect(food).toContain("life-meal-edit-icon");
    expect(food).not.toContain("编辑这顿");
    expect(food).not.toContain("编辑这次");
    expect(food).toContain("+ 添加{label}");
  });

  it("keeps compact meal photo/macros while removing implementation copy", () => {
    const editor = source("components/life/LifeMealEditorPage.tsx");
    expect(editor).toContain("grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]");
    expect(editor).toContain("＋ 上传照片");
    expect(editor).toContain('label="蛋白质"');
    expect(editor).toContain('label="脂肪"');
    expect(editor).toContain('label="碳水"');
    expect(editor).not.toContain("和饮食列表使用同样的紧凑构图");
    expect(editor).toContain("把这一餐轻轻记下来");
  });

  it("uses consistent SVG Nest art and a dedicated chevron column", () => {
    const nest = source("components/life/LifeNestPage.tsx");
    const css = source("app/r8-2-ui-calibration.css");
    expect(nest).toContain("NestFeatureIcon");
    expect(nest).toContain("life-nest-tile-copy");
    expect(nest).toContain("<svg");
    expect(css).toContain("grid-template-columns: minmax(0,1fr) 1.25rem");
    expect(css).toContain("position: static !important");
  });

  it("keeps weight behavior but removes implementation explanations", () => {
    const weight = source("components/life/LifeWeightPage.tsx");
    expect(weight).toContain('label: "周"');
    expect(weight).toContain('label: "月"');
    expect(weight).toContain('label: "季度"');
    expect(weight).toContain('label: "年"');
    expect(weight).toContain('useState<Period>("month")');
    expect(weight).toContain("function dailyAverages");
    expect(weight).toContain("measuredAtFrom(date, time)");
    expect(weight).not.toContain("不再记录备注");
    expect(weight).not.toContain("先求日平均");
    expect(weight).toContain("慢慢看见自己的变化");
  });

  it("uses the approved stationery mailbox visual while keeping immutable sent items", () => {
    const mailbox = source("components/life/LifeMailboxPage.tsx");
    const css = source("app/mailbox-visual-closeout.css");
    const layout = source("app/layout.tsx");
    const route = source("app/api/life/mailbox/[id]/route.ts");
    expect(mailbox).toContain("收信箱");
    expect(mailbox).toContain("已寄出");
    expect(mailbox).toContain("待寄出");
    expect(mailbox).toContain("life-mailbox-tabs-v3");
    expect(mailbox).toContain("MailboxTabIcon");
    expect(mailbox).toContain("life-mailbox-month-sheet");
    expect(mailbox).toContain("life-mailbox-preview-thumb");
    expect(mailbox).toContain('value === "letter" ? "手札" : "明信片"');
    expect(mailbox).toContain("手札需要一个标题");
    expect(mailbox).toContain("LETTER_PAGE_CHARS");
    expect(mailbox).toContain("＋ 添加一页");
    expect(mailbox).toContain("life-letter-paper-modal");
    expect(mailbox).toContain("LetterCornerArt");
    expect(mailbox).toContain("life-postcard-modal");
    expect(mailbox).toContain("PostcardStamp");
    expect(mailbox).toContain('item.status === "draft"');
    expect(mailbox).toContain("寄出后将不能再编辑");
    expect(mailbox).toContain("寄出后内容会永久保持只读");
    expect(mailbox).not.toContain("纸张主题");
    expect(css).toContain("aspect-ratio: 1.62 / 1");
    expect(css).toContain(".life-letter-paper-modal");
    expect(css).toContain(".life-postcard-address-lines");
    expect(layout).toContain('import "./mailbox-visual-closeout.css"');
    expect(route).toContain("MAILBOX_IMMUTABLE");
    expect(route).toContain("sendMailboxDraft");
    expect(mailbox).not.toContain("✉️ 信纸");
  });

  it("simplifies My to nickname sync and data management while hiding the R9 /ai entry", () => {
    const me = source("components/life/LifeMePage.tsx");
    expect(me).toContain('currentPartnerKey === "cat" ? "小猫"');
    expect(me).toContain('currentPartnerKey === "fish" ? "小鱼"');
    expect(me).toContain("云端同步");
    expect(me).toContain('href="/me/data"');
    expect(me).not.toContain("身份映射");
    expect(me).not.toContain("写入权限");
    expect(me).not.toContain("生活 AI 助手");
    expect(me).not.toContain('href="/ai"');
  });

  it("keeps real data management without legacy-program or game-machine explanations", () => {
    const page = source("components/life/LifeDataManagementPage.tsx");
    const route = source("app/api/life/data-management/route.ts");
    expect(page).toContain("立即备份");
    expect(page).toContain("导出 JSON");
    expect(page).toContain("导入 JSON");
    expect(page).toContain("恢复点");
    expect(page).not.toContain("变美变瘦大作战");
    expect(page).not.toContain("game-machine");
    expect(route).toContain('const RESTORE_CONFIRMATION = "确认恢复生活数据"');
  });

  it("renders medicine stock and expiry as compact cards", () => {
    const medicine = source("components/life/LifeMedicinePage.tsx");
    const css = source("app/r8-3-visual-polish.css");
    expect(medicine).toContain("life-medicine-overview");
    expect(medicine).toContain("life-medicine-card");
    expect(medicine).toContain("life-medicine-stock");
    expect(medicine).toContain("daysText(item.finalExpiryDate)");
    expect(css).toContain(".life-medicine-card.status-soon");
    expect(css).toContain(".life-medicine-card.status-expired");
  });

  it("uses visual-language chevrons for games instead of 开始游戏 arrows", () => {
    const game = source("components/life/LifeGameMachinePage.tsx");
    expect(game).toContain("life-game-chevron");
    expect(game).not.toContain("开始游戏 →");
    expect(game).not.toContain("当前只接一个已有游戏");
  });
});