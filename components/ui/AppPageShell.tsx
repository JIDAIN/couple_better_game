import type { ReactNode } from "react";

export function AppPageShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <main className="island-life-v2 min-h-screen">
      <div className="life-page-shell">
        {(title || subtitle || actions) && (
          <header className="life-page-header flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title ? <h1 className="life-page-title font-extrabold text-[var(--life-text)]">{title}</h1> : null}
              {subtitle ? <p className="life-page-subtitle text-[var(--life-text-body)]">{subtitle}</p> : null}
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </header>
        )}
        {children}
      </div>
    </main>
  );
}
