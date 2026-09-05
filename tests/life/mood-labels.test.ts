import { describe, expect, it } from "vitest";

import { MOOD_LABELS, moodLabel, withMoodLabel } from "../../lib/life/mood-labels";

describe("mood labels", () => {
  it("keeps the product mood semantics instead of English literal meanings", () => {
    expect(moodLabel("neutral")).toBe("心动");
    expect(moodLabel("calm")).toBe("平静");
  });

  it("defines all eight mood labels", () => {
    expect(MOOD_LABELS).toEqual({
      happy: "开心",
      calm: "平静",
      neutral: "心动",
      anxious: "烦躁",
      sad: "伤心",
      angry: "生气",
      tired: "心累",
      excited: "兴奋",
    });
  });

  it("adds moodLabel without changing the internal moodKey", () => {
    expect(
      withMoodLabel({
        partnerKey: "fish" as const,
        moodKey: "neutral" as const,
      }),
    ).toEqual({
      partnerKey: "fish",
      moodKey: "neutral",
      moodLabel: "心动",
    });
  });
});
