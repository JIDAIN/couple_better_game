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

  return (
    <>
      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-rose-100/90 bg-white/55 px-4 py-2 text-sm font-semibold text-stone-600 shadow-sm backdrop-blur-sm transition hover:border-rose-200 hover:bg-white/80 hover:text-stone-800 active:scale-[0.98]"
        >
          <span aria-hidden>🎁</span>
          兑换商店
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            aria-label="关闭兑换"
            className={`absolute inset-0 bg-stone-900/25 backdrop-blur-[2px] transition-opacity duration-300 ${
              sheetEnter ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`relative max-h-[min(88dvh,560px)] w-full rounded-t-[1.35rem] border border-white/80 bg-gradient-to-b from-rose-50/95 to-amber-50/90 px-4 pt-3 shadow-[0_-8px_40px_rgba(251,207,232,0.35)] transition-transform duration-300 ease-out will-change-transform ${
              sheetEnter ? "translate-y-0" : "translate-y-full"
            } pb-[max(1.25rem,env(safe-area-inset-bottom))]`}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300/70" aria-hidden />

            <div className="flex items-start justify-between gap-3 border-b border-rose-100/60 pb-3">
              <div>
                <h2
                  id={titleId}
                  className="text-base font-bold text-stone-800"
                >
                  小小兑换角
                </h2>
                <p className="mt-0.5 text-[11px] text-stone-500">
                  用攒下的亮晶晶，换一点点甜头
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-2 py-1 text-sm font-medium text-stone-400 transition hover:bg-white/60 hover:text-stone-600"
              >
                收起
              </button>
            </div>

            <div className="mt-3 flex gap-2 rounded-2xl border border-white/70 bg-white/50 px-3 py-2.5 text-xs backdrop-blur-sm">
              <span className="flex flex-1 items-center gap-1.5 font-semibold text-stone-700">
                <span aria-hidden>💎</span>
                宝石
                <span className="tabular-nums text-stone-500">
                  {gemStock}/{GEM_CAP}
                </span>
              </span>
              <span className="w-px shrink-0 bg-rose-100/80" aria-hidden />
              <span className="flex flex-1 items-center gap-1.5 font-semibold text-stone-700">
                <span aria-hidden>🪙</span>
                金币
                <span className="tabular-nums text-stone-500">{coinStock}</span>
              </span>
            </div>

            <div className="mt-3 max-h-[min(52vh,360px)] space-y-2 overflow-y-auto overscroll-contain pb-2 pt-1">
              {REDEEM_ITEMS.map((item) => {
                const affordable = canAfford(item);
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/70 bg-white/55 p-3 shadow-sm backdrop-blur-sm"
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-100/90 to-amber-100/80 text-lg"
                        aria-hidden
                      >
                        {item.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold leading-snug text-stone-800">
                          {item.title}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-stone-500">
                          {item.priceGems != null && item.priceCoins != null
                            ? `需要 ${item.priceGems} 颗宝石 · ${item.priceCoins} 枚金币`
                            : item.priceGems != null
                              ? `需要 ${item.priceGems} 颗宝石`
                              : item.priceCoins != null
                                ? `需要 ${item.priceCoins} 枚金币`
                                : null}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!affordable}
                      onClick={() => onRedeem(item)}
                      className="mt-2.5 w-full rounded-xl border border-rose-100/80 bg-rose-50/60 py-2 text-xs font-bold text-rose-700 transition enabled:hover:border-rose-200 enabled:hover:bg-rose-100/50 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {affordable ? "兑换" : "资源不够啦"}
                    </button>
                  </div>
                );
              })}
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
