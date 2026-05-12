import type { ExerciseTag, HeatLevel } from "./types";

const levelClass: Record<HeatLevel, string> = {
  none: "bg-stone-200/85 border-stone-300/50",
  ok: "bg-emerald-200/95 border-emerald-300/55",
  good: "bg-emerald-600/90 border-emerald-700/35",
  perfect:
    "bg-gradient-to-br from-amber-300 via-yellow-300 to-amber-400 border-amber-400/60",
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
        "relative mx-auto h-3 w-full max-w-[18px] rounded-[3px] border sm:h-4 sm:max-w-[22px]",
        "transition duration-200 ease-out",
        "hover:z-10 hover:scale-125 hover:shadow-md hover:shadow-amber-200/40",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-300/80",
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
