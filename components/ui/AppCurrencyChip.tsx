import type { GameIconName } from "./AppGameIcon";
import { AppGameIcon } from "./AppGameIcon";

export type CurrencyKind = "gem" | "coin";

export type AppCurrencyChipProps = {
  currency: CurrencyKind;
  value: number;
  /** Show "+" prefix for positive values. Default true. */
  showSign?: boolean;
  /** Show value number. Default true. Set false for stock/count displays. */
  showValue?: boolean;
  /** Additional context (e.g. "/50" for cap display) */
  suffix?: string;
  size?: "sm" | "md";
  className?: string;
};

const CURRENCY_ICON: Record<CurrencyKind, GameIconName> = {
  gem: "gem",
  coin: "coin",
};

const CURRENCY_LABEL: Record<CurrencyKind, string> = {
  gem: "宝石",
  coin: "金币",
};

const SIZE_CLASS: Record<"sm" | "md", string> = {
  sm: "app-currency-chip--sm",
  md: "app-currency-chip--md",
};

export function AppCurrencyChip({
  currency,
  value,
  showSign = true,
  showValue = true,
  suffix,
  size = "md",
  className = "",
}: AppCurrencyChipProps) {
  const sign = showSign && value > 0 ? "+" : "";
  const label = `${CURRENCY_LABEL[currency]} ${sign}${value}${suffix ?? ""}`;

  return (
    <span
      className={`app-currency-chip ${SIZE_CLASS[size]} ${className}`.trim()}
      data-currency={currency}
      aria-label={label}
    >
      <AppGameIcon name={CURRENCY_ICON[currency]} size={size === "sm" ? 12 : 14} />
      <span>{showValue ? `${sign}${value}${suffix ?? ""}` : suffix ?? ""}</span>
    </span>
  );
}
