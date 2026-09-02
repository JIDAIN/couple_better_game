"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isLifeNavItemActive, type LifeNavHref } from "@/lib/life/navigation";
import { LifeIcon, type LifeIconName } from "./LifeIcon";

const items: ReadonlyArray<{ href: LifeNavHref; icon: LifeIconName; label: string }> = [
  { href: "/", icon: "today", label: "今日" },
  { href: "/food", icon: "food", label: "饮食" },
  { href: "/calendar", icon: "calendar", label: "日历" },
  { href: "/nest", icon: "nest", label: "小窝" },
  { href: "/me", icon: "me", label: "我的" },
];

const baseClass = "life-bottom-nav-item flex min-h-12 flex-col items-center justify-center gap-1 px-1 text-[10px] font-bold transition duration-[var(--life-motion-fast)]";

export function AppLifeBottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="生活系统主导航" className="life-bottom-nav fixed inset-x-0 bottom-0 z-40 px-2 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto grid w-full max-w-[46rem] grid-cols-5 gap-1">
        {items.map((item) => {
          const active = isLifeNavItemActive(pathname, item.href);
          const content = <><LifeIcon name={item.icon} className="life-bottom-nav-icon" /><span>{item.label}</span></>;
          if (active) {
            return <span key={item.href} aria-current="page" className={`${baseClass} is-active cursor-default text-[var(--life-teal-strong)]`}>{content}</span>;
          }
          return <Link key={item.href} href={item.href} prefetch className={`${baseClass} text-[var(--life-text-muted)]`}>{content}</Link>;
        })}
      </div>
    </nav>
  );
}
