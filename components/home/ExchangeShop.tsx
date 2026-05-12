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

type ShopMode = "browse" | "manage" | "create" | "edit";
type ResourceKind = "gem" | "coin";

type ManageFormState = {
  title: string;
  icon: string;
  resource: ResourceKind;
  price: string;
  description: string;
};

const EMPTY_FORM: ManageFormState = {
  title: "",
  icon: "",
  resource: "coin",
  price: "",
  description: "",
};

function getItemResource(item: RedeemItem) {
  return item.priceCoins != null ? ("coin" as const) : ("gem" as const);
}

function getItemPrice(item: RedeemItem) {
  return item.priceCoins ?? item.priceGems ?? 0;
}

function toFormState(item?: RedeemItem | null): ManageFormState {
  if (!item) return EMPTY_FORM;
  return {
    title: item.title,
    icon: item.icon,
    resource: getItemResource(item),
    price: String(getItemPrice(item)),
    description: ITEM_HINT[item.id] ?? "",
  };
}

export function ExchangeShop() {
  const { gemStock, coinStock, tryRedeem } = useHomeResources();
  const [open, setOpen] = useState(false);
  const [sheetEnter, setSheetEnter] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mode, setMode] = useState<ShopMode>("browse");
  const [activeItem, setActiveItem] = useState<RedeemItem | null>(null);
  const [formState, setFormState] = useState<ManageFormState>(EMPTY_FORM);
  const titleId = useId();
  const prevOverflow = useRef<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!open) {
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
      if (e.key === "Escape") closeShop();
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

  function closeShop() {
    setSheetEnter(false);
    setMode("browse");
    setActiveItem(null);
    setFormState(EMPTY_FORM);
    setOpen(false);
  }

  function openShop() {
    setSheetEnter(false);
    setMode("browse");
    setActiveItem(null);
    setFormState(EMPTY_FORM);
    setOpen(true);
  }

  const openManage = () => setMode("manage");
  const backToBrowse = () => setMode("browse");
  const openCreate = () => {
    setActiveItem(null);
    setFormState(EMPTY_FORM);
    setMode("create");
  };
  const openEdit = (item: RedeemItem) => {
    setActiveItem(item);
    setFormState(toFormState(item));
    setMode("edit");
  };
  const closeForm = () => {
    setActiveItem(null);
    setFormState(EMPTY_FORM);
    setMode("manage");
  };

  const renderManageForm = () => {
    const isEdit = mode === "edit";
    const title = isEdit ? "编辑商品" : "新增商品";
    return (
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1">
        <div className="ui-card-soft p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-amber-700/80">
                {title}
              </p>
              <h3 className="mt-0.5 text-sm font-bold text-stone-800">
                {isEdit ? activeItem?.title ?? "当前商品" : "给宝库加一个新宝贝"}
              </h3>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="ui-button-secondary shrink-0 px-3 py-1 text-xs font-semibold text-stone-500"
            >
              返回
            </button>
          </div>

          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="text-[11px] font-semibold text-stone-600">
                商品名
              </span>
              <input
                value={formState.title}
                onChange={(e) =>
                  setFormState((v) => ({ ...v, title: e.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-white/80 bg-white/70 px-3 py-2.5 text-sm font-semibold text-stone-800 outline-none ring-0 placeholder:text-stone-300"
                placeholder="例如：双人奶茶时光"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
              <label className="block">
                <span className="text-[11px] font-semibold text-stone-600">
                  图标
                </span>
                <input
                  value={formState.icon}
                  onChange={(e) =>
                    setFormState((v) => ({ ...v, icon: e.target.value }))
                  }
                  className="mt-1 w-full rounded-2xl border border-white/80 bg-white/70 px-3 py-2.5 text-sm font-semibold text-stone-800 outline-none ring-0 placeholder:text-stone-300"
                  placeholder="🍰"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold text-stone-600">
                  资源类型
                </span>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((v) => ({ ...v, resource: "gem" }))
                    }
                    className={`flex-1 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
                      formState.resource === "gem"
                        ? "border-fuchsia-200/90 bg-fuchsia-50/85 text-fuchsia-700"
                        : "border-white/80 bg-white/60 text-stone-500"
                    }`}
                  >
                    宝石
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((v) => ({ ...v, resource: "coin" }))
                    }
                    className={`flex-1 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
                      formState.resource === "coin"
                        ? "border-amber-200/90 bg-amber-50/85 text-amber-700"
                        : "border-white/80 bg-white/60 text-stone-500"
                    }`}
                  >
                    金币
                  </button>
                </div>
              </label>
            </div>

            <label className="block">
              <span className="text-[11px] font-semibold text-stone-600">
                价格
              </span>
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-white/80 bg-white/70 px-3 py-2.5">
                <input
                  value={formState.price}
                  onChange={(e) =>
                    setFormState((v) => ({ ...v, price: e.target.value }))
                  }
                  inputMode="numeric"
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-stone-800 outline-none placeholder:text-stone-300"
                  placeholder="0"
                />
                <span className="shrink-0 text-[11px] font-medium text-stone-400">
                  {formState.resource === "coin" ? "枚" : "颗"}
                </span>
              </div>
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold text-stone-600">
                简短描述
              </span>
              <textarea
                value={formState.description}
                onChange={(e) =>
                  setFormState((v) => ({ ...v, description: e.target.value }))
                }
                rows={3}
                className="mt-1 w-full resize-none rounded-2xl border border-white/80 bg-white/70 px-3 py-2.5 text-sm font-medium text-stone-700 outline-none placeholder:text-stone-300"
                placeholder="一句话说明这个商品"
              />
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="flex-1 rounded-2xl border border-stone-200/75 bg-white/55 py-2.5 text-sm font-semibold text-stone-500 transition hover:bg-white/80"
            >
              取消
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="flex-[1.3] rounded-2xl border border-amber-200/85 bg-gradient-to-r from-amber-50 to-rose-50 py-2.5 text-sm font-semibold text-stone-700 shadow-sm shadow-amber-100/35"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderManageList = () => (
    <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1">
      <div className="flex items-center justify-between gap-3">
        <p className="px-1 text-[11px] font-semibold tracking-wide text-amber-700/80">
          当前商品
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="ui-button-secondary px-3 py-1.5 text-xs font-semibold text-stone-600"
        >
          新增商品
        </button>
      </div>

      <div className="mt-2.5 space-y-2">
        {REDEEM_ITEMS.map((item) => {
          const resource = getItemResource(item);
          const price = getItemPrice(item);
          return (
            <article
              key={item.id}
              className="rounded-2xl border border-white/80 bg-white/58 px-3 py-3 shadow-sm shadow-stone-100/30"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/80 bg-gradient-to-br from-rose-100/90 to-amber-100/80 text-lg"
                  aria-hidden
                >
                  {item.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-stone-800">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-stone-500">
                    {ITEM_HINT[item.id]}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${
                        resource === "gem"
                          ? "border-fuchsia-200/80 bg-fuchsia-50/85 text-fuchsia-700"
                          : "border-amber-200/80 bg-amber-50/85 text-amber-700"
                      }`}
                    >
                      {resource === "gem" ? "💎 宝石" : "🪙 金币"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-stone-200/70 bg-stone-50/80 px-2 py-1 text-[10px] font-semibold text-stone-600">
                      价格 {price}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="ui-button-secondary px-3 py-1.5 text-[11px] font-semibold text-stone-600"
                >
                  编辑
                </button>
                <button
                  type="button"
                  className="rounded-full border border-stone-200/75 bg-white/50 px-3 py-1.5 text-[11px] font-semibold text-stone-500 transition hover:bg-white/80"
                >
                  删除
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={openShop}
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
            onClick={closeShop}
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
                <div className="flex shrink-0 items-center gap-2">
                  {mode === "browse" ? (
                    <button
                      type="button"
                      onClick={openManage}
                      className="ui-button-secondary px-3 py-1 text-xs font-semibold text-stone-500"
                    >
                      管理
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={backToBrowse}
                      className="ui-button-secondary px-3 py-1 text-xs font-semibold text-stone-500"
                    >
                      返回
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeShop}
                    className="ui-button-secondary px-3 py-1 text-xs font-semibold text-stone-500"
                  >
                    收起
                  </button>
                </div>
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

            {mode === "manage"
              ? renderManageList()
              : mode === "create" || mode === "edit"
                ? renderManageForm()
                : (
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
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/80 bg-gradient-to-br from-amber-100/90 to-stone-100/80 text-lg"
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
                      <p className="px-1 text-[11px] font-semibold tracking-wide text-stone-500">
                        💎 宝石小甜头
                      </p>
                      {gemItems.map((item) => {
                        const affordable = canAfford(item);
                        return (
                          <div key={item.id} className="ui-card-soft p-2.5">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/80 bg-gradient-to-br from-rose-100/90 to-stone-100/80 text-lg"
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
                                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200/80 bg-rose-50/85 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
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
                )}
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
