"use client";

import type { ReactNode } from "react";
import { AppLifeBottomNav } from "@/components/ui/AppLifeBottomNav";

export type LifeAppShellProps = {
  children: ReactNode;
};

export function LifeAppShell({ children }: LifeAppShellProps) {
  return (
    <div className="island-life-v2 min-h-screen bg-[var(--life-bg)]">
      <div className="pb-20">{children}</div>
      <AppLifeBottomNav />
    </div>
  );
}
