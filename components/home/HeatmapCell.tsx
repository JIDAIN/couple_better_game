import type { ExerciseTag, HeatLevel } from "./types";

const levelClass: Record<HeatLevel, string> = {
  none: "heat-cell-none",
  ok: "heat-cell-ok",
  good: "heat-cell-good",
  perfect: "heat-cell-perfect",
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
        "heat-cell relative mx-auto h-3 w-full max-w-[18px] rounded-[5px] border sm:h-4 sm:max-w-[22px] sm:rounded-md",
        "hover:z-10 hover:scale-125",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1",
        levelClass[level],
      ].join(" ")}
      role="img"
      aria-label={title}
    >
      {icon ? (
        <span
          className="pointer-events-none absolute -right-px -top-px origin-top-right scale-[0.45] leading-none sm:scale-[0.5]"
          aria-hidden
        >
          {icon}
        </span>
      ) : null}
      <span className="sr-only">{title}</span>
    </div>
  );
}
