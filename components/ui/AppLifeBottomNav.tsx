"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", icon: "🌿", label: "今日" },
  { href: "/food", icon: "🍽️", label: "饮食" },
  { href: "/calendar", icon: "📅", label: "日历" },
  { href: "/nest", icon: "🏠", label: "小窝" },
  { href: "/me", icon: "⚙️", label: "我的" },
] as const;

export function AppLifeBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="生活系统主导航"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--life-border-soft)] bg-[color:color-mix(in_srgb,var(--life-surface)_94%,transparent)] px-2 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] shadow-[0_-6px_22px_rgb(78_92_85_/_0.07)] backdrop-blur-md"
    >
      <div className="mx-auto grid w-full max-w-[46rem] grid-cols-5 gap-1">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[var(--life-radius-control)] px-1 text-[11px] font-bold transition duration-[var(--life-motion-fast)] ${
                active
                  ? "bg-[var(--life-surface-soft)] text-[var(--life-teal-strong)]"
                  : "text-[var(--life-text-muted)] hover:bg-[var(--life-surface-soft)] hover:text-[var(--life-text-body)]"
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
