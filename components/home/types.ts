/** 单日热量缺口完成程度（热力图底色） */
export type HeatLevel = "none" | "ok" | "good" | "perfect";

/** 运动角标 */
export type ExerciseTag = "none" | "run" | "intense";

export type HeatmapDay = {
  level: HeatLevel;
  exercise: ExerciseTag;
};
