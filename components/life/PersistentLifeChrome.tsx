"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppLifeBottomNav } from "@/components/ui/AppLifeBottomNav";

const PREFETCH_ROUTES = ["/", "/food", "/calendar", "/nest", "/me"] as const;

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
  const showNavigation = isLifePath(pathname);

  useEffect(() => {
    if (!showNavigation) return;
    for (const route of PREFETCH_ROUTES) router.prefetch(route);
  }, [router, showNavigation]);

  return <>{children}{showNavigation ? <AppLifeBottomNav /> : null}</>;
}
