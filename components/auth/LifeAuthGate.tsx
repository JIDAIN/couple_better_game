"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLifeAuth } from "./LifeAuthProvider";

export function LifeAuthGate({ children }: { children: ReactNode }) {
  const { loading, authenticated, identity } = useLifeAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!authenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    if (!identity?.coupleSpaceId) {
      router.replace("/setup");
    }
  }, [authenticated, identity?.coupleSpaceId, loading, pathname, router]);

  if (loading || !authenticated || !identity?.coupleSpaceId) {
    return (
      <div className="island-life-v2 grid min-h-screen place-items-center bg-[var(--life-bg)] px-6 text-center">
        <div>
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-[var(--life-mint)]" />
          <p className="mt-4 text-sm font-bold text-[var(--life-text-muted)]">正在确认岛屿身份…</p>
        </div>
      </div>
    );
  }

  return children;
}
