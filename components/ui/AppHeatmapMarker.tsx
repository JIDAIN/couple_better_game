import { AppGameIcon, type GameIconName } from "./AppGameIcon";

export type ExerciseIntensity = "run" | "intense";

export type AppHeatmapMarkerProps = {
  intensity: ExerciseIntensity;
  size?: number;
  className?: string;
};

const INTENSITY_ICON: Record<ExerciseIntensity, GameIconName> = {
  run: "run",
  intense: "fire",
};

const INTENSITY_LABEL: Record<ExerciseIntensity, string> = {
  run: "有氧运动",
  intense: "剧烈运动",
};

/**
 * Heatmap cell exercise intensity marker.
 *
 * Replaces raw 🏃/🔥 emoji in heatmap cells and legend.
 * Uses AppGameIcon internally for unified asset routing.
 */
export function AppHeatmapMarker({
  intensity,
  size = 12,
  className = "",
}: AppHeatmapMarkerProps) {
  return (
    <span className={className} aria-label={INTENSITY_LABEL[intensity]}>
      <AppGameIcon name={INTENSITY_ICON[intensity]} size={size} />
    </span>
  );
}
