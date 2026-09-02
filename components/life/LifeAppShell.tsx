"use client";

import type { ReactNode } from "react";
import { LifeAuthGate } from "@/components/auth/LifeAuthGate";
import { AppLifeBottomNav } from "@/components/ui/AppLifeBottomNav";

export type LifeAppShellProps = { children: ReactNode };

export function LifeAppShell({ children }: LifeAppShellProps) {
  return (
    <LifeAuthGate>
      <div className="island-life-v2 min-h-screen bg-[var(--life-bg)]">
        <div className="pb-20">{children}</div>
        <AppLifeBottomNav />
      </div>
    </LifeAuthGate>
  );
}
