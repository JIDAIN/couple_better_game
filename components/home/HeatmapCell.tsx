import type { ExerciseTag, HeatLevel } from "./types";
import { AppHeatmapMarker } from "../ui";

const levelClass: Record<HeatLevel, string> = {
  empty: "heat-cell-empty",
  "over-light": "heat-cell-miss",
  "over-mid": "heat-cell-miss",
  "over-strong": "heat-cell-miss",
  "over-heavy": "heat-cell-miss",
  none: "heat-cell-miss",
  ok: "heat-cell-normal",
  good: "heat-cell-good",
  perfect: "heat-cell-great",
};

export function HeatmapCell({
  level,
  exercise,
  title,
  muted = false,
}: {
  level: HeatLevel;
  exercise: ExerciseTag;
  title: string;
  muted?: boolean;
}) {
  const hasExercise = exercise !== "none";

  return (
    <div
      title={title}
      className={[
        "heat-cell relative mx-auto",
        "hover:z-10 hover:scale-110",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1",
        levelClass[level],
        muted ? "opacity-45 saturate-[0.75]" : "",
      ].join(" ")}
      role="img"
      aria-label={title}
    >
      {hasExercise ? (
        <span
          className="pointer-events-none absolute -right-1 -top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/75 text-[9px] leading-none shadow-[0_1px_3px_rgb(120_80_60_/_0.14)]"
          aria-hidden
        >
          <AppHeatmapMarker intensity={exercise as "run" | "intense"} size={9} />
        </span>
      ) : null}
      <span className="sr-only">{title}</span>
    </div>
  );
}
