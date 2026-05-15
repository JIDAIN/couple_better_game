"use client";

import { useState } from "react";
import { useHomeResources, type ExchangeCategory } from "./HomeResourcesProvider.safe";

function resourceLabel(kind: ExchangeCategory["resourceKind"]) {
  return kind === "gem" ? "宝石" : "金币";
}

export function ExchangeShop() {
  const { gemStock, coinStock, exchangeCategories, redeemExchange } = useHomeResources();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canAfford = (category: ExchangeCategory) =>
    category.resourceKind === "gem" ? gemStock >= category.price : coinStock >= category.price;

  const onRedeem = (category: ExchangeCategory) => {
    const ok = redeemExchange({
      category: category.title,
      remark: "",
      resourceKind: category.resourceKind,
      price: category.price,
      icon: category.icon,
    });
    setToast(ok ? `已兑换：${category.title} ✨` : "余额还差一点点");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ui-button-secondary group flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-stone-600 shadow-sm shadow-rose-100/25 transition duration-200 hover:-translate-y-0.5 hover:bg-white/85 active:translate-y-0"
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <span className="text-base" aria-hidden>🎁</span>
          <span className="truncate">奖励兑换商店</span>
        </span>
        <span className="shrink-0 text-[11px] font-semibold text-stone-400 transition group-hover:text-rose-500">
          打开
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[55] flex items-end justify-center p-2.5 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="关闭奖励兑换商店"
            className="absolute inset-0 bg-stone-900/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex max-h-[78dvh] w-full max-w-lg flex-col overflow-hidden rounded-[1.45rem] border border-white/80 bg-gradient-to-b from-rose-50/98 via-white/90 to-amber-50/85 px-4 pt-3 shadow-2xl shadow-rose-200/40 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300/70" aria-hidden />
            <div className="rounded-[1.15rem] border border-white/75 bg-white/70 px-3.5 py-3 shadow-sm shadow-rose-100/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-stone-800">🎁 奖励兑换商店</h2>
                  <p className="mt-0.5 text-[11px] font-medium text-stone-500">把努力变成一起期待的小快乐</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="ui-button-secondary shrink-0 px-3 py-1 text-xs font-semibold text-stone-500">
                  收起
                </button>
              </div>
              <div className="mt-2 flex gap-2 text-[11px] font-semibold text-stone-500">
                <span className="rounded-full bg-rose-50/80 px-2.5 py-1">💎 {gemStock}</span>
                <span className="rounded-full bg-amber-50/80 px-2.5 py-1">🪙 {coinStock}</span>
              </div>
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1">
              <div className="space-y-2">
                {exchangeCategories.map((category) => {
                  const affordable = canAfford(category);
                  return (
                    <article key={category.id} className="rounded-[1.05rem] border border-white/80 bg-white/58 px-3 py-2.5 shadow-sm shadow-stone-100/25">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white/70 text-base" aria-hidden>{category.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-stone-700">{category.title}</p>
                          <p className="mt-0.5 line-clamp-1 text-[10px] font-medium text-stone-400">{category.description}</p>
                          <p className="mt-1 text-[10px] font-semibold text-stone-500">消耗 {category.price} {resourceLabel(category.resourceKind)}</p>
                        </div>
                        <button
                          type="button"
                          disabled={!affordable}
                          onClick={() => onRedeem(category)}
                          className="shrink-0 rounded-full border border-white/80 bg-white/72 px-3 py-1.5 text-[11px] font-semibold text-stone-600 shadow-sm shadow-rose-100/20 transition hover:bg-white/85 disabled:cursor-not-allowed disabled:border-stone-200/80 disabled:bg-stone-100/70 disabled:text-stone-400 disabled:shadow-none"
                        >
                          {affordable ? "兑换" : "差一点"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
            {toast ? <p className="py-2 text-center text-[11px] font-semibold text-rose-500">{toast}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
