import { AppGameIcon } from "./AppGameIcon";

export type AppProgressBarProps = {
  value: number;
  max: number;
  label?: string;
  className?: string;
};

/**
 * Coin treasure progress bar.
 *
 * Wraps the ui-progress-track/ui-progress-fill pattern.
 */
export function AppProgressBar({
  value,
  max,
  label = "金币小宝箱",
  className = "",
}: AppProgressBarProps) {
  const pct = Math.min(100, Math.round((value / max) * 100));

  return (
    <div className={`layout-card-soft layout-card-item relative overflow-hidden ${className}`.trim()}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold ui-text-main">
          <AppGameIcon name="coin" size={16} /> {label}
        </span>
        <span
          suppressHydrationWarning
          className="text-[11px] font-semibold tabular-nums ui-text-muted"
        >
          {value} / {max}
        </span>
      </div>
      <div
        className="ui-progress-track mt-2 h-2.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="ui-progress-fill h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] font-medium ui-text-muted">
        装满以后会有小惊喜
      </p>
    </div>
  );
}

