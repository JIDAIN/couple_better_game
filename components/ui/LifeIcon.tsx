import type { ReactNode, SVGProps } from "react";

export type LifeIconName = "today" | "food" | "calendar" | "nest" | "me";

const paths: Record<LifeIconName, ReactNode> = {
  today: <><path d="M12 21v-9"/><path d="M12 12c-4 0-7-2.4-7-6 4 0 7 2.4 7 6Z"/><path d="M12 15c4 0 7-2.4 7-6-4 0-7 2.4-7 6Z"/></>,
  food: <><path d="M6 3v7M3.5 3v4.5A2.5 2.5 0 0 0 6 10M8.5 3v4.5A2.5 2.5 0 0 1 6 10v11"/><path d="M16 3v18M16 3c3 1.2 4.5 4 4.5 7.5H16"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>,
  nest: <><path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
  me: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></>,
};

export function LifeIcon({ name, ...props }: { name: LifeIconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {paths[name]}
    </svg>
  );
}
