"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppLifeBottomNav } from "@/components/ui/AppLifeBottomNav";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";

const PREFETCH_ROUTES = ["/", "/food", "/calendar", "/nest", "/me"] as const;
const MIN_SPLASH_MS = 620;

function isLifePath(pathname: string) {
  return pathname === "/"
    || pathname === "/food" || pathname.startsWith("/food/")
    || pathname === "/calendar" || pathname.startsWith("/calendar/")
    || pathname === "/nest" || pathname.startsWith("/nest/")
    || pathname === "/me" || pathname.startsWith("/me/")
    || pathname === "/ai" || pathname.startsWith("/ai/");
}

export function PersistentLifeChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { bootstrapReady } = useLifeIdentity();
  const showNavigation = isLifePath(pathname);
  const startedAt = useRef<number>(Date.now());
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (!showNavigation) return;
    for (const route of PREFETCH_ROUTES) router.prefetch(route);
  }, [router, showNavigation]);

  useEffect(() => {
    if (!showNavigation) {
      setSplashDone(true);
      return;
    }
    if (!bootstrapReady) return;
    const elapsed = Date.now() - startedAt.current;
    const timer = window.setTimeout(() => setSplashDone(true), Math.max(0, MIN_SPLASH_MS - elapsed));
    return () => window.clearTimeout(timer);
  }, [bootstrapReady, showNavigation]);

  const showSplash = showNavigation && !splashDone;

  return (
    <>
      <div className={showSplash ? "life-app-under-splash" : undefined} aria-hidden={showSplash || undefined}>{children}</div>
      {showNavigation && !showSplash ? <AppLifeBottomNav /> : null}
      {showSplash ? <LifeStartupSplash /> : null}
    </>
  );
}

function LifeStartupSplash() {
  return (
    <div className="life-startup-splash" role="status" aria-live="polite" aria-label="正在准备岛屿生活">
      <div className="life-startup-sky" aria-hidden>
        <span className="life-startup-cloud is-one" />
        <span className="life-startup-cloud is-two" />
        <span className="life-startup-sun" />
      </div>
      <div className="life-startup-island" aria-hidden>
        <span className="life-startup-tree"><i /><b /></span>
        <span className="life-startup-home">⌂</span>
      </div>
      <div className="life-startup-copy">
        <strong>岛屿生活</strong>
        <span>小岛正在醒来</span>
        <span className="life-startup-dots" aria-hidden><i /><i /><i /></span>
      </div>
    </div>
  );
}
