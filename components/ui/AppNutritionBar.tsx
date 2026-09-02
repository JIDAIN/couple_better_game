export function AppNutritionBar({
  label,
  value,
  unit,
  percent,
  tone = "teal",
}: {
  label: string;
  value: number | string;
  unit?: string;
  percent: number;
  tone?: "teal" | "yellow" | "coral" | "blue";
}) {
  const color = {
    teal: "var(--life-teal)",
    yellow: "var(--life-yellow)",
    coral: "var(--life-coral)",
    blue: "var(--life-blue)",
  }[tone];

  const width = `${Math.max(0, Math.min(100, percent))}%`;

  return (
    <div className="life-nutrition-bar">
      <span>{label}</span>
      <span className="life-nutrition-track">
        <span className="life-nutrition-fill block" style={{ width, background: color }} />
      </span>
      <strong className="font-semibold text-[var(--life-text)] tabular-nums">
        {value}{unit ?? ""}
      </strong>
    </div>
  );
}
