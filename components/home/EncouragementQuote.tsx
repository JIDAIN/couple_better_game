"use client";

import { getDailyQuote } from "@/lib/home/daily-quote";
import { Title } from "animal-island-ui";
import { AppCard } from "../ui";

export function EncouragementQuote() {
  const quote = getDailyQuote();

  return (
    <AppCard variant="soft" className="text-center" aria-label="今日小纸条">
      <Title size="small" color="app-yellow">
        今日小纸条
      </Title>
      <p
        className="mt-2 text-[14px] font-semibold leading-relaxed ui-text-main"
        suppressHydrationWarning
      >
        {quote}
      </p>
    </AppCard>
  );
}
