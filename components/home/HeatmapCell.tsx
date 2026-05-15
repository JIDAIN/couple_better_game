import type { ExerciseTag, HeatLevel } from "./types";

const levelClass: Record<HeatLevel, string> = {
  none: "heat-cell-empty",
  ok: "heat-cell-normal",
  good: "heat-cell-good",
  perfect: "heat-cell-great",
};

const exerciseIcon: Record<ExerciseTag, string> = {
  none: "",
  run: "🏃",
  intense: "🔥",
};

export function HeatmapCell({
  level,
  exercise,
  title,
}: {
  level: HeatLevel;
  exercise: ExerciseTag;
  title: string;
}) {
  const icon = exerciseIcon[exercise];

  return (
    <div
      title={title}
      className={[
        "heat-cell relative mx-auto",
        "hover:z-10 hover:scale-110",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1",
        levelClass[level],
      ].join(" ")}
      role="img"
      aria-label={title}
    >
      {icon ? (
        <span
          className="pointer-events-none absolute -right-1 -top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/75 text-[9px] leading-none shadow-[0_1px_3px_rgb(120_80_60_/_0.14)]"
          aria-hidden
        >
          {icon}
        </span>
      ) : null}
      <span className="sr-only">{title}</span>
    </div>
  );
}
