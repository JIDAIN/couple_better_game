import type { ReactNode } from "react";
import { AppButton } from "./AppButton";

export type AppBottomNavItemProps = {
  active: boolean;
  icon: ReactNode;
  label: ReactNode;
  onClick: () => void;
  className?: string;
};

export function AppBottomNavItem({
  active,
  icon,
  label,
  onClick,
  className = "",
}: AppBottomNavItemProps) {
  return (
    <AppButton
      type="button"
      variant={active ? "primary" : "secondary"}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`app-bottom-nav-item flex-1 py-2.5 text-sm transition ${
        active ? "app-bottom-nav-item--active" : ""
      } ${className}`.trim()}
    >
      <span className="flex flex-col items-center gap-0.5">
        <span className="text-base" aria-hidden>
          {icon}
        </span>
        <span className="text-[11px]">{label}</span>
      </span>
    </AppButton>
  );
}
