import type { ReactNode } from "react";

export function AppFeatureTile({
  icon,
  title,
  description,
  badge,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  badge?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="life-feature-tile" onClick={onClick}>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] text-xl">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm text-[var(--life-text)]">{title}</strong>
        {description ? <span className="mt-0.5 block text-xs leading-5 text-[var(--life-text-body)]">{description}</span> : null}
      </span>
      {badge ? <span className="shrink-0">{badge}</span> : <span className="shrink-0 text-[var(--life-text-muted)]">›</span>}
    </button>
  );
}
