"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { GEM_CAP, useHomeResources } from "./HomeResourcesProvider";

type RedeemItem = {
  id: string;
  title: string;
  priceGems?: number;
  priceCoins?: number;
  icon: string;
};

const REDEEM_ITEMS: RedeemItem[] = [
  {
    id: "hotpot",
    title: "火锅/寿司/烧烤",
    priceCoins: 4,
    icon: "🍲",
  },
  {
    id: "bbq",
    title: "烤肉自助/汉堡炸鸡",
    priceCoins: 8,
    icon: "🍖",
  },
  {
    id: "dq",
    title: "奶茶（dq）",
    priceGems: 8,
    icon: "🧋",
  },
  {
    id: "milk2",
    title: "双份奶茶",
    priceGems: 15,
    icon: "🧋",
  },
  {
    id: "family",
    title: "家庭放纵餐",
    priceGems: 15,
    icon: "🏡",
  },
];

const ITEM_HINT: Record<string, string> = {
  hotpot: "热乎乎的约会晚餐",
  bbq: "快乐暴击补给",
  dq: "甜甜续航一下",
  milk2: "双人份加倍开心",
  family: "周末放松仪式感",
};

export function ExchangeShop() {
  const { gemStock, coinStock, tryRedeem } = useHomeResources();
  const [open, setOpen] = useState(false);
  const [sheetEnter, setSheetEnter] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const titleId = useId();
  const prevOverflow = useRef<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!open) {
      setSheetEnter(false);
      return;
    }
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setSheetEnter(true)),
    );
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    prevOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow.current ?? "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onRedeem = useCallback(
    (item: RedeemItem) => {
      const ok = tryRedeem({
        gems: item.priceGems,
        coins: item.priceCoins,
      });
      if (ok) setToast(`「${item.title}」兑换成功～ 好好享受吧 ✨`);
    },
    [tryRedeem],
  );

  const canAfford = (item: RedeemItem) => {
    const g = item.priceGems ?? 0;
    const c = item.priceCoins ?? 0;
    return gemStock >= g && coinStock >= c;
  };

  const coinItems = REDEEM_ITEMS.filter((item) => item.priceCoins != null);
  const gemItems = REDEEM_ITEMS.filter((item) => item.priceGems != null);

  return (
    <>
      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ui-button-secondary inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-stone-600"
        >
          <span aria-hidden>🎁</span>
          兑换商店
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[55] flex items-end justify-center p-2.5 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="关闭兑换"
            className={`absolute inset-0 bg-stone-900/30 backdrop-blur-[2px] transition-opacity duration-300 ${
              sheetEnter ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`relative flex h-[78dvh] w-full max-w-lg flex-col overflow-hidden rounded-[1.45rem] border border-white/80 bg-gradient-to-b from-rose-50/98 via-white/90 to-amber-50/85 px-4 pt-3 shadow-2xl shadow-rose-200/40 transition-all duration-300 ease-out will-change-transform ${
              sheetEnter
                ? "translate-y-0 opacity-100 sm:scale-100"
                : "translate-y-full opacity-90 sm:translate-y-2 sm:scale-95"
            } pb-[max(1.25rem,env(safe-area-inset-bottom))]`}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300/70" aria-hidden />

            <div className="relative overflow-hidden rounded-[1.15rem] border border-white/75 bg-gradient-to-r from-rose-100/70 via-amber-50/80 to-rose-50/70 px-3.5 py-3 shadow-sm shadow-rose-100/50">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-white/40 blur-xl"
              />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <h2
                    id={titleId}
                    className="mt-0.5 text-base font-bold text-stone-800"
                  >
                    🎁 恋爱宝库
                  </h2>
                  <p className="mt-0.5 text-[11px] font-medium text-stone-500">
                    用攒下的亮晶晶，换一点点甜头
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="ui-button-secondary shrink-0 px-3 py-1 text-xs font-semibold text-stone-500"
                >
                  收起
                </button>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-200/80 bg-fuchsia-50/90 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-700">
                  <span aria-hidden>💎</span>
                  {gemStock}/{GEM_CAP}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50/90 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                  <span aria-hidden>🪙</span>
                  {coinStock}
                </span>
              </div>
            </div>

            <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-1">
              <section className="space-y-2">
                <p className="px-1 text-[11px] font-semibold tracking-wide text-amber-700/80">
                  🪙 金币大餐
                </p>
                {coinItems.map((item) => {
                  const affordable = canAfford(item);
                  return (
                    <div key={item.id} className="ui-card-soft p-2.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/80 bg-gradient-to-br from-amber-100/90 to-orange-100/80 text-lg"
                          aria-hidden
                        >
                          {item.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-stone-800">
                            {item.title}
                          </p>
                          <p className="text-[10px] font-medium text-stone-500">
                            {ITEM_HINT[item.id]}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50/85 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            <span aria-hidden>🪙</span>
                            {item.priceCoins}
                          </span>
                          <button
                            type="button"
                            disabled={!affordable}
                            onClick={() => onRedeem(item)}
                            className="ui-button-secondary px-3 py-1 text-[11px] font-semibold text-stone-600 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {affordable ? "兑换" : "差一点"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>

              <section className="space-y-2">
                <p className="px-1 text-[11px] font-semibold tracking-wide text-fuchsia-700/80">
                  💎 宝石小甜头
                </p>
                {gemItems.map((item) => {
                  const affordable = canAfford(item);
                  return (
                    <div key={item.id} className="ui-card-soft p-2.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/80 bg-gradient-to-br from-fuchsia-100/90 to-rose-100/80 text-lg"
                          aria-hidden
                        >
                          {item.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-stone-800">
                            {item.title}
                          </p>
                          <p className="text-[10px] font-medium text-stone-500">
                            {ITEM_HINT[item.id]}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-200/80 bg-fuchsia-50/85 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-700">
                            <span aria-hidden>💎</span>
                            {item.priceGems}
                          </span>
                          <button
                            type="button"
                            disabled={!affordable}
                            onClick={() => onRedeem(item)}
                            className="ui-button-secondary px-3 py-1 text-[11px] font-semibold text-stone-600 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {affordable ? "兑换" : "差一点"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          className="pointer-events-none fixed bottom-[max(5.5rem,env(safe-area-inset-bottom))] left-1/2 z-[60] w-[min(92vw,22rem)] -translate-x-1/2 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-center text-xs font-semibold leading-relaxed text-stone-700 shadow-lg shadow-rose-200/40 backdrop-blur-md"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
