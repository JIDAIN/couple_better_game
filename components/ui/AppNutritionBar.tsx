export function AppNutritionBar({
  label,
  value,
  unit,
  percent,
  max,
  tone = "teal",
}: {
  label: string;
  value: number | string | null;
  unit?: string;
  percent?: number;
  max?: number;
  tone?: "teal" | "yellow" | "coral" | "blue";
}) {
  const color = {
    teal: "var(--life-teal)",
    yellow: "var(--life-yellow)",
    coral: "var(--life-coral)",
    blue: "var(--life-blue)",
  }[tone];

  const derivedPercent =
    percent ??
    (typeof value === "number" && max && max > 0 ? (value / max) * 100 : 0);
  const width = `${Math.max(0, Math.min(100, derivedPercent))}%`;
  const displayValue = value == null ? "—" : `${value}${unit ?? ""}`;

  return (
    <div className="life-nutrition-bar">
      <span>{label}</span>
      <span className="life-nutrition-track">
        <span className="life-nutrition-fill block" style={{ width, background: color }} />
      </span>
      <strong className="font-semibold text-[var(--life-text)] tabular-nums">
        {displayValue}
      </strong>
    </div>
  );
}
