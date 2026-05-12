import { CoupleGrowthPanel } from "./CoupleGrowthPanel";
import { DualMonthlyHeatmaps } from "./DualMonthlyHeatmaps";
import { EncouragementQuote } from "./EncouragementQuote";
import { ExchangeShop } from "./ExchangeShop";
import { GameTitle } from "./GameTitle";
import { HomeResourcesProvider } from "./HomeResourcesProvider";
import { RecordTodayButton } from "./RecordTodayButton";

export function HomeScreen() {
  return (
    <HomeResourcesProvider>
      <div className="relative min-h-dvh overflow-x-hidden bg-gradient-to-b from-rose-50 via-orange-50/35 to-amber-50/85 pb-8 pt-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 top-10 h-56 w-56 rounded-full bg-fuchsia-200/24 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-1/3 h-64 w-64 rounded-full bg-amber-200/24 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-emerald-200/20 blur-3xl"
        />

        <div className="relative mx-auto flex w-full max-w-md flex-col gap-4.5 px-4 sm:px-5">
          <GameTitle />

          <CoupleGrowthPanel />

          <DualMonthlyHeatmaps />

          <EncouragementQuote />

          <RecordTodayButton />

          <ExchangeShop />
        </div>
      </div>
    </HomeResourcesProvider>
  );
}
