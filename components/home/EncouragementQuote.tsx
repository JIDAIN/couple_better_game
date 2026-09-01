"use client";

import { getDailyQuote } from "@/lib/home/daily-quote";

export function EncouragementQuote() {
  const quote = getDailyQuote();

  return (
    <section className="app-card--soft app-card--main text-center" aria-label="今日鼓励">
      <p className="text-[10px] font-semibold tracking-[0.16em] ui-text-primary">
        今日小纸条
      </p>
      <p
        className="mt-2 text-[14px] font-semibold leading-relaxed ui-text-main"
        suppressHydrationWarning
      >
        {quote}
      </p>
    </section>
  );
}
