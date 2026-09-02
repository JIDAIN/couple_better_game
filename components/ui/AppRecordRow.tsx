import type { ReactNode } from "react";

export function AppRecordRow({
  icon,
  title,
  description,
  trailing,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="life-record-row">
      {icon ? <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--life-radius-sm)] bg-[var(--life-surface-soft)]">{icon}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-[var(--life-text)]">{title}</div>
        {description ? <div className="mt-0.5 text-xs leading-5 text-[var(--life-text-body)]">{description}</div> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
