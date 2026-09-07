"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useStaleQuery } from "@/lib/client/use-stale-query";
import {
  effectiveReminderTime,
  fetchLifeReminders,
  type LifeReminderItem,
} from "@/lib/life/reminder-client";

const EMPTY_REMINDERS: LifeReminderItem[] = [];

function sourceIcon(sourceKind: LifeReminderItem["sourceKind"]) {
  if (sourceKind === "medicine") return "💊";
  if (sourceKind === "anniversary") return "💛";
  return "🔔";
}

function timeText(item: LifeReminderItem) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(effectiveReminderTime(item)));
}

export function TodayReminderCard() {
  const fetcher = useCallback(() => fetchLifeReminders(), []);
  const query = useStaleQuery<LifeReminderItem[]>({
    key: "life-reminders-home",
    fetcher,
    staleMs: 30_000,
  });
  const items = query.data ?? EMPTY_REMINDERS;

  const upcoming = useMemo(
    () =>
      items
        .filter((item) => item.status === "pending" || item.status === "snoozed")
        .sort(
          (a, b) =>
            new Date(effectiveReminderTime(a)).getTime() -
            new Date(effectiveReminderTime(b)).getTime(),
        )
        .slice(0, 3),
    [items],
  );

  return (
    <section className="life-surface life-section-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-[var(--life-text)]">接下来</p>
          <p className="mt-1 text-[10px] text-[var(--life-text-muted)]">最近需要记住的小事</p>
        </div>
        <Link href="/me/reminders" className="text-xs font-extrabold text-[var(--life-teal-strong)]">
          全部
        </Link>
      </div>

      <div className="mt-3 grid gap-2">
        {upcoming.length ? (
          upcoming.map((item) => (
            <Link
              key={item.id}
              href="/me/reminders"
              className="flex items-center gap-3 rounded-2xl bg-white/60 px-3 py-2.5"
            >
              <span className="text-base" aria-hidden>{sourceIcon(item.sourceKind)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-extrabold text-[var(--life-text)]">{item.title}</p>
                <p className="mt-0.5 text-[10px] text-[var(--life-text-muted)]">{timeText(item)}</p>
              </div>
              <span className="text-xs text-[var(--life-text-muted)]" aria-hidden>›</span>
            </Link>
          ))
        ) : query.loading && !query.data ? (
          <p className="text-xs text-[var(--life-text-muted)]">正在看看接下来有什么…</p>
        ) : (
          <p className="text-xs text-[var(--life-text-muted)]">暂时没有需要提醒的事情。</p>
        )}
      </div>
    </section>
  );
}
