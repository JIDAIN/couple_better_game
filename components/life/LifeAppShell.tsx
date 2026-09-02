import type { ReactNode } from "react";

export type LifeAppShellProps = {
  children: ReactNode;
};

export function LifeAppShell({ children }: LifeAppShellProps) {
  return <>{children}</>;
}
