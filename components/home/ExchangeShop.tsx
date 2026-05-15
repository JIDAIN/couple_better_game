"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  GEM_CAP,
  useHomeResources,
  type ExchangeCategory,
  type ResourceKind,
} from "./HomeResourcesProvider";

type CategoryFormState = {
  title: string;
  icon: string;
  description: string;
  resourceKind: ResourceKind;
  price: string;
};

type OverlayState =
  | { kind: "record"; categoryId: string }
  | { kind: "history" }
  | { kind: "category"; categoryId: string | null }
  | null;

type RecordFormState = {
  remark: string;
  occurredAt: string;
};

const EMPTY_CATEGORY_FORM: CategoryFormState = {
  title: "",
  icon: "",
  description: "",
  resourceKind: "gem",
  price: "",
};

const EMPTY_RECORD_FORM: RecordFormState = {
  remark: "",
  occurredAt: "",
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function currentDateTimeLocalValue() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate(),
  )}T${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return currentDateTimeLocalValue();
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function resourceLabel(kind: ResourceKind) {
  return kind === "gem" ? "宝石" : "金币";
}

function resourceIcon(kind: ResourceKind) {
  return kind === "gem" ? "💎" : "🪙";
}

function categoryTone(kind: ResourceKind) {
  return kind === "gem" ? "ui-chip-primary" : "ui-chip-reward";
}

function categoryPriceLabel(category: ExchangeCategory) {
  return `${category.price}${resourceIcon(category.resourceKind)}`;
}

function recordPriceLabel(price: number, kind: ResourceKind) {
  return `${price}${resourceIcon(kind)}`;
}

function formFromCategory(category?: ExchangeCategory | null): CategoryFormState {
  if (!category) return EMPTY_CATEGORY_FORM;
  return {
    title: category.title,
    icon: category.icon,
    description: category.description,
    resourceKind: category.resourceKind,
    price: String(category.price),
  };
}

function getCategoryChipClass(kind: ResourceKind) {
  return kind === "gem" ? "ui-chip-primary" : "ui-chip-reward";
}

export function ExchangeShop() {
  const {
    gemStock,
    coinStock,
    redeemExchange,
    updateExchangeRecord,
    deleteExchangeRecord,
    exchangeRecords,
    exchangeCategories: categories,
    upsertExchangeCategory,
    deleteExchangeCategory,
  } = useHomeResources();
  const [open, setOpen] = useState(false);
  const [sheetEnter, setSheetEnter] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mode, setMode] = useState<"browse" | "manage">("browse");
  const [overlay, setOverlay] = useState<OverlayState>(null);
  const [overlayEnter, setOverlayEnter] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(
    EMPTY_CATEGORY_FORM,
  );
  const [recordForm, setRecordForm] = useState<RecordFormState>(
    EMPTY_RECORD_FORM,
  );
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const titleId = useId();
  const overlayTitleId = useId();
  const prevOverflow = useRef<string | null>(null);

  const selectedCategory =
    overlay?.kind === "record"
      ? categories.find((item) => item.id === overlay.categoryId) ?? null
      : null;
  const selectedRecord =
    editingRecordId != null
      ? exchangeRecords.find((item) => item.id === editingRecordId) ?? null
      : null;

  const closeOverlay = useCallback(() => {
    setOverlayEnter(false);
    setOverlay(null);
    setRecordForm(EMPTY_RECORD_FORM);
    setEditingRecordId(null);
    setCategoryForm(EMPTY_CATEGORY_FORM);
  }, []);

  const openOverlay = useCallback((next: OverlayState) => {
    setOverlay(next);
    setOverlayEnter(false);
    if (next?.kind === "category") {
      const source =
        next.categoryId == null
          ? null
          : categories.find((item) => item.id === next.categoryId) ?? null;
      setCategoryForm(formFromCategory(source));
      setRecordForm(EMPTY_RECORD_FORM);
      setEditingRecordId(null);
    } else if (next?.kind === "history") {
      setCategoryForm(EMPTY_CATEGORY_FORM);
      setRecordForm(EMPTY_RECORD_FORM);
      setEditingRecordId(null);
    }
  }, [categories]);

  const closeShop = useCallback(() => {
    closeOverlay();
    setMode("browse");
    setSheetEnter(false);
    setOpen(false);
  }, [closeOverlay]);

  const openShop = useCallback(() => {
    closeOverlay();
    setMode("browse");
    setSheetEnter(false);
    setOpen(true);
  }, [closeOverlay]);

  const openRecord = useCallback((categoryId: string) => {
    setEditingRecordId(null);
    setRecordForm({
      remark: "",
      occurredAt: currentDateTimeLocalValue(),
    });
    openOverlay({ kind: "record", categoryId });
  }, [openOverlay]);

  const openEditRecord = useCallback(
    (recordId: string) => {
      const source = exchangeRecords.find((item) => item.id === recordId);
      if (!source) return;
      setEditingRecordId(recordId);
      setRecordForm({
        remark: source.remark,
        occurredAt: toDateTimeLocalValue(source.occurredAt),
      });
      openOverlay({
        kind: "record",
        categoryId:
          categories.find((item) => item.title === source.category)?.id ?? "",
      });
    },
    [categories, exchangeRecords, openOverlay],
  );

  const openHistory = useCallback(() => {
    openOverlay({ kind: "history" });
  }, [openOverlay]);

  const openCategoryForm = useCallback(
    (categoryId: string | null) => {
      openOverlay({ kind: "category", categoryId });
    },
    [openOverlay],
  );

  const closeCategoryMode = useCallback(() => {
    setMode("browse");
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setSheetEnter(true)),
    );
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    prevOverflow.current = prev;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow.current ?? "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (overlay) {
        closeOverlay();
        return;
      }
      if (mode === "manage") {
        closeCategoryMode();
        return;
      }
      closeShop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, overlay, mode, closeOverlay, closeCategoryMode, closeShop]);

  useEffect(() => {
    if (!overlay) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setOverlayEnter(true)),
    );
    return () => cancelAnimationFrame(id);
  }, [overlay]);

  const saveCategory = useCallback(() => {
    const parsedPrice = Number.parseInt(categoryForm.price, 10);
    const nextCategory: ExchangeCategory = {
      id:
        overlay?.kind === "category" && overlay.categoryId
          ? overlay.categoryId
          : `category-${Date.now()}`,
      title: categoryForm.title.trim() || "新类别",
      icon: categoryForm.icon.trim() || "✨",
      description:
        categoryForm.description.trim() || "给自己留一笔温柔的小奖励",
      resourceKind: categoryForm.resourceKind,
      price: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 1,
    };

    upsertExchangeCategory(nextCategory);
    closeOverlay();
  }, [categoryForm, closeOverlay, overlay, upsertExchangeCategory]);

  const deleteCategory = useCallback((categoryId: string) => {
    deleteExchangeCategory(categoryId);
  }, [deleteExchangeCategory]);

  const saveExchangeRecord = useCallback(() => {
    const note = recordForm.remark.trim();
    const occurredAt = recordForm.occurredAt || currentDateTimeLocalValue();

    if (editingRecordId) {
      const ok = updateExchangeRecord(editingRecordId, {
        occurredAt,
        remark: note,
      });
      if (!ok) return;
      setToast("已更新兑换记录");
      closeOverlay();
      return;
    }

    if (!selectedCategory) return;
    const ok = redeemExchange({
      category: selectedCategory.title,
      remark: note,
      resourceKind: selectedCategory.resourceKind,
      price: selectedCategory.price,
      icon: selectedCategory.icon,
      occurredAt,
    });
    if (!ok) return;

    setToast(
      note
        ? `已兑换：${selectedCategory.title} · ${note} ✨`
        : `已兑换：${selectedCategory.title} ✨`,
    );
    closeOverlay();
  }, [
    closeOverlay,
    editingRecordId,
    redeemExchange,
    recordForm.occurredAt,
    recordForm.remark,
    selectedCategory,
    updateExchangeRecord,
  ]);
  const canAfford = useCallback(
    (category: ExchangeCategory) => {
      if (category.resourceKind === "gem") return gemStock >= category.price;
      return coinStock >= category.price;
    },
    [coinStock, gemStock],
  );

  const renderBrowseList = () => {
    const gemCategories = categories.filter(
      (category) => category.resourceKind === "gem",
    );
    const coinCategories = categories.filter(
      (category) => category.resourceKind === "coin",
    );

    const renderCategoryCard = (category: ExchangeCategory) => {
      const affordable = canAfford(category);
      const isGem = category.resourceKind === "gem";
      const cardClass = isGem ? "ui-tinted-primary" : "ui-tinted-reward";
      const iconClass = isGem ? "ui-chip-primary" : "ui-chip-reward";
      const priceClass = isGem ? "ui-chip-primary" : "ui-chip-reward";
      const buttonClass = "ui-button-secondary";
      return (
        <article
          key={category.id}
          className={`ui-card-soft ui-card-compact transition ${cardClass}`}
        >
          <div className="flex min-w-0 items-start gap-2">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center text-base ${iconClass}`}
              aria-hidden
            >
              {category.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-bold leading-4 ui-text-main sm:text-[13px]">
                {category.title}
              </p>
              <p className="mt-0.5 line-clamp-1 text-[10px] font-medium leading-3 ui-text-soft">
                {category.description}
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-1.5">
                <span
                  className={`ui-badge shrink-0 py-0.5 text-[10px] tabular-nums ${priceClass}`}
                >
                  {categoryPriceLabel(category)}
                </span>
                <button
                  type="button"
                  disabled={!affordable}
                  onClick={() => openRecord(category.id)}
                  className={`shrink-0 px-2.5 py-1 text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${buttonClass}`}
                >
                  {affordable ? "兑换" : "差一点"}
                </button>
              </div>
            </div>
          </div>
        </article>
      );
    };

    const renderSection = (title: string, items: ExchangeCategory[]) => (
      <section className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 px-1">
          <p
            className={`text-sm font-bold tracking-wide ${
              title.includes("宝石") ? "ui-text-primary" : "ui-text-reward"
            }`}
          >
            {title}
          </p>
        </div>
        {items.length > 0 ? (
          <div className="space-y-1.5">{items.map(renderCategoryCard)}</div>
        ) : (
          <div className="ui-soft-panel ui-card-item py-5 text-center text-[11px] font-semibold ui-text-soft">
            {title.includes("宝石") ? "还没有宝石商品" : "还没有金币商品"}
          </div>
        )}
      </section>
    );

    return (
      <div className="mt-2.5 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1">
        <div className="grid grid-cols-2 gap-2">
          {renderSection("💎 宝石兑换", gemCategories)}
          {renderSection("🪙 金币兑换", coinCategories)}
        </div>

        <section className="mt-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <p className="px-1 text-[11px] font-semibold tracking-wide ui-text-muted">
              已兑换记录
            </p>
            <button
              type="button"
              onClick={openHistory}
              className="ui-button-secondary px-3 py-1.5 text-[11px] font-semibold"
            >
              查看记录
            </button>
          </div>
          {exchangeRecords.length > 0 ? (
            <div className="space-y-1.5">
              {exchangeRecords.slice(0, 3).map((record) => (
                <article key={record.id} className="ui-soft-panel ui-card-item">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-semibold tracking-wide ui-text-soft">
                        {record.date}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] font-semibold ui-text-main">
                        {record.icon} {record.category}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      <span
                        className={`ui-badge py-0.5 text-[10px] tabular-nums ${getCategoryChipClass(
                          record.resourceKind,
                        )}`}
                      >
                        {recordPriceLabel(record.price, record.resourceKind)}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditRecord(record.id)}
                        className="ui-button-secondary px-3 py-1 text-[11px] font-semibold"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const ok = deleteExchangeRecord(record.id);
                          if (ok) setToast("已删除兑换记录");
                        }}
                        className="ui-button-secondary px-3 py-1 text-[11px] font-semibold opacity-80"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="ui-soft-panel ui-card-compact text-[11px] font-medium ui-text-soft">
              还没有兑换记录，攒到喜欢的奖励再来换吧。
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderManageList = () => {
    const gemCategories = categories.filter(
      (category) => category.resourceKind === "gem",
    );
    const coinCategories = categories.filter(
      (category) => category.resourceKind === "coin",
    );

    const renderCategoryCard = (category: ExchangeCategory) => (
      <article
        key={category.id}
        className="ui-card-soft ui-card-compact"
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center text-base ${categoryTone(
              category.resourceKind,
            )}`}
            aria-hidden
          >
            {category.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold ui-text-main">
              {category.title}
            </p>
            <p className="mt-0.5 line-clamp-1 text-[10px] font-medium ui-text-soft">
              {category.description}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span
                className={`ui-badge py-0.5 text-[10px] ${getCategoryChipClass(
                  category.resourceKind,
                )}`}
              >
                {resourceLabel(category.resourceKind)}
              </span>
              <span className="ui-badge ui-chip-plain py-0.5 text-[10px]">
                {categoryPriceLabel(category)}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => openCategoryForm(category.id)}
              className="ui-button-secondary px-3 py-1.5 text-[11px] font-semibold"
            >
              编辑
            </button>
            <button
              type="button"
              onClick={() => deleteCategory(category.id)}
              className="ui-button-secondary px-3 py-1.5 text-[11px] font-semibold opacity-80"
            >
              删除
            </button>
          </div>
        </div>
      </article>
    );

    const renderSection = (title: string, items: ExchangeCategory[]) => (
      <section className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-[11px] font-semibold tracking-wide ui-text-muted">
            {title}
          </p>
          <span className="text-[10px] font-semibold ui-text-soft">
            {items.length} 项
          </span>
        </div>
        <div className="space-y-1.5">
          {items.map(renderCategoryCard)}
        </div>
      </section>
    );

    return (
      <div className="mt-2.5 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1">
        <div className="flex items-center justify-between gap-3">
          <p className="px-1 text-[11px] font-semibold tracking-wide ui-text-muted">
            奖励模板
          </p>
          <button
            type="button"
            onClick={() => openCategoryForm(null)}
            className="ui-button-secondary px-3 py-1.5 text-xs font-semibold"
          >
            新增类别
          </button>
        </div>

        <div className="mt-2 space-y-3">
          {renderSection("宝石类", gemCategories)}
          {renderSection("金币类", coinCategories)}
        </div>
      </div>
    );
  };
  const renderOverlay = () => {
    if (!overlay) return null;

    if (overlay.kind === "history") {
      return (
        <div className="absolute inset-0 z-10 flex items-end justify-center p-2.5 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="关闭已兑换记录"
            className={`ui-modal-backdrop absolute inset-0 transition-opacity duration-300 ${
              overlayEnter ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeOverlay}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={overlayTitleId}
            className={`ui-dialog ui-dialog-content relative w-full max-w-md transition-all duration-300 ease-out ${
              overlayEnter
                ? "translate-y-0 opacity-100"
                : "translate-y-4 opacity-0"
            }`}
          >
            <div className="flex items-start justify-between gap-3 pb-3">
              <div>
                <h3
                  id={overlayTitleId}
                  className="text-base font-semibold tracking-tight ui-text-main"
                >
                  兑换记录
                </h3>
                <p className="mt-0.5 text-[11px] font-medium ui-text-soft">
                  最近的小奖励都在这里
                </p>
              </div>
              <button
                type="button"
                onClick={closeOverlay}
                className="ui-button-secondary shrink-0 px-3 py-1 text-xs font-semibold"
              >
                返回
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {exchangeRecords.length > 0 ? (
                exchangeRecords.map((record) => (
                  <article
                    key={record.id}
                    className="ui-soft-panel ui-card-item"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-semibold tracking-wide ui-text-soft">
                          {record.date}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] font-semibold ui-text-main">
                          {record.icon} {record.category}
                          {record.remark ? ` · ${record.remark}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <span
                          className={`ui-badge py-0.5 text-[10px] tabular-nums ${getCategoryChipClass(
                            record.resourceKind,
                          )}`}
                        >
                          {recordPriceLabel(record.price, record.resourceKind)}
                        </span>
                        <button
                          type="button"
                          onClick={() => openEditRecord(record.id)}
                          className="ui-button-secondary px-3 py-1 text-[11px] font-semibold"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const ok = deleteExchangeRecord(record.id);
                            if (ok) setToast("已删除兑换记录");
                          }}
                          className="ui-button-secondary px-3 py-1 text-[11px] font-semibold opacity-80"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="ui-soft-panel ui-card-item py-5 text-center text-xs font-semibold ui-text-muted">
                  还没有兑换记录，攒到喜欢的奖励再来换一笔。
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (overlay.kind === "record") {
      const isEditing = editingRecordId != null;
      const record = selectedRecord;
      const category = selectedCategory;
      const displayIcon = isEditing ? record?.icon : category?.icon;
      const displayTitle = isEditing ? record?.category : category?.title;
      const displayResource = isEditing ? record?.resourceKind : category?.resourceKind;
      const displayPrice = isEditing ? record?.price : category?.price;
      const canSubmit = isEditing ? true : category != null;

      if (!displayIcon || !displayTitle || !displayResource || displayPrice == null) {
        return null;
      }

      return (
        <div className="absolute inset-0 z-10 flex items-end justify-center p-2.5 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label={isEditing ? "关闭记录编辑" : "关闭记录兑换"}
            className={`ui-modal-backdrop absolute inset-0 transition-opacity duration-300 ${
              overlayEnter ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeOverlay}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={overlayTitleId}
            className={`ui-dialog ui-dialog-content relative w-full max-w-md transition-all duration-300 ease-out ${
              overlayEnter
                ? "translate-y-0 opacity-100"
                : "translate-y-4 opacity-0"
            }`}
          >
            <div className="flex items-start justify-between gap-3 pb-3">
              <div>
                <p className="text-[11px] font-semibold tracking-wide ui-text-soft">
                  {isEditing ? "编辑兑换记录" : "记录兑换"}
                </p>
                <h3
                  id={overlayTitleId}
                  className="mt-0.5 text-base font-semibold tracking-tight ui-text-main"
                >
                  {displayIcon} {displayTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeOverlay}
                className="ui-button-secondary shrink-0 px-3 py-1 text-xs font-semibold"
              >
                取消
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <span
                className={`ui-badge py-1 text-[11px] ${getCategoryChipClass(
                  displayResource,
                )}`}
              >
                {resourceLabel(displayResource)}
              </span>
              <span className={`ui-badge ui-chip-plain py-1 text-[11px] tabular-nums ${getCategoryChipClass(displayResource)}`}>
                {recordPriceLabel(displayPrice, displayResource)}
              </span>
            </div>

            <label className="mt-3 block">
              <span className="ui-field-label">
                时间
              </span>
              <input
                type="datetime-local"
                value={recordForm.occurredAt}
                onChange={(e) =>
                  setRecordForm((current) => ({
                    ...current,
                    occurredAt: e.target.value,
                  }))
                }
                className="ui-input mt-1 w-full px-3 py-2.5 text-sm font-semibold outline-none"
              />
            </label>

            <label className="mt-3 block">
              <span className="ui-field-label">
                备注
              </span>
              <input
                value={recordForm.remark}
                onChange={(e) =>
                  setRecordForm((current) => ({
                    ...current,
                    remark: e.target.value,
                  }))
                }
                className="ui-input mt-1 w-full px-3 py-2.5 text-sm font-semibold outline-none"
                placeholder="例如：下午茶 / 小奖励 / 周末加餐"
              />
            </label>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeOverlay}
                className="ui-button-secondary flex-1 py-2.5 text-sm font-semibold"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveExchangeRecord}
                disabled={!canSubmit}
                className="ui-button-primary flex-[1.3] py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isEditing ? "保存修改" : "确认兑换"}
              </button>
            </div>
          </div>
        </div>
      );
    }    if (overlay.kind === "category") {
      const isEdit = overlay.categoryId != null;

      return (
        <div className="absolute inset-0 z-10 flex items-end justify-center p-2.5 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="关闭类别表单"
            className={`ui-modal-backdrop absolute inset-0 transition-opacity duration-300 ${
              overlayEnter ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeOverlay}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={overlayTitleId}
            className={`ui-dialog ui-dialog-content relative w-full max-w-md transition-all duration-300 ease-out ${
              overlayEnter
                ? "translate-y-0 opacity-100"
                : "translate-y-4 opacity-0"
            }`}
          >
            <div className="flex items-start justify-between gap-3 pb-3">
              <div>
                <p className="text-[11px] font-semibold tracking-wide ui-text-soft">
                  {isEdit ? "编辑类别" : "新增类别"}
                </p>
                <h3
                  id={overlayTitleId}
                  className="mt-0.5 text-base font-semibold tracking-tight ui-text-main"
                >
                  {isEdit ? "修改一个小奖励模板" : "添加一个新的小奖励模板"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeOverlay}
                className="ui-button-secondary shrink-0 px-3 py-1 text-xs font-semibold"
              >
                返回
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="ui-field-label">
                  类别名称
                </span>
                <input
                  value={categoryForm.title}
                  onChange={(e) =>
                    setCategoryForm((current) => ({
                      ...current,
                      title: e.target.value,
                    }))
                  }
                  className="ui-input mt-1 w-full px-3 py-2.5 text-sm font-semibold outline-none"
                  placeholder="例如：小零食"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
                <label className="block">
                  <span className="ui-field-label">
                    图标
                  </span>
                  <input
                    value={categoryForm.icon}
                    onChange={(e) =>
                      setCategoryForm((current) => ({
                        ...current,
                        icon: e.target.value,
                      }))
                    }
                    className="ui-input mt-1 w-full px-3 py-2.5 text-sm font-semibold outline-none"
                    placeholder="🍦"
                  />
                </label>

                <label className="block">
                  <span className="ui-field-label">
                    消耗资源
                  </span>
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCategoryForm((current) => ({
                          ...current,
                          resourceKind: "gem",
                        }))
                      }
                      className={`ui-tab flex-1 text-sm transition ${
                        categoryForm.resourceKind === "gem"
                          ? "ui-tab-active"
                          : "ui-tab-idle"
                      }`}
                    >
                      宝石
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCategoryForm((current) => ({
                          ...current,
                          resourceKind: "coin",
                        }))
                      }
                      className={`ui-tab flex-1 text-sm transition ${
                        categoryForm.resourceKind === "coin"
                          ? "ui-tab-active"
                          : "ui-tab-idle"
                      }`}
                    >
                      金币
                    </button>
                  </div>
                </label>
              </div>

              <label className="block">
                <span className="ui-field-label">
                  消耗数量
                </span>
                <div className="ui-input-shell mt-1 flex items-center gap-2 px-3 py-2.5">
                  <input
                    value={categoryForm.price}
                    onChange={(e) =>
                      setCategoryForm((current) => ({
                        ...current,
                        price: e.target.value,
                      }))
                    }
                    inputMode="numeric"
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold ui-text-main outline-none"
                    placeholder="5"
                  />
                  <span className="shrink-0 text-[11px] font-medium ui-text-soft">
                    {resourceLabel(categoryForm.resourceKind)}
                  </span>
                </div>
              </label>

              <label className="block">
                <span className="ui-field-label">
                  描述
                </span>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm((current) => ({
                      ...current,
                      description: e.target.value,
                    }))
                  }
                  rows={3}
                  className="ui-input mt-1 w-full resize-none px-3 py-2.5 text-sm font-medium outline-none"
                  placeholder="简单写一句这个奖励为什么可爱"
                />
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeOverlay}
                className="ui-button-secondary flex-1 py-2.5 text-sm font-semibold"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveCategory}
                className="ui-button-primary flex-[1.3] py-2.5 text-sm font-semibold text-white"
              >
                保存类别
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <div className="w-full">
        <button
          type="button"
          onClick={openShop}
          className="ui-nav-button inline-flex w-full whitespace-nowrap text-[12px] sm:text-sm"
        >
          <span aria-hidden>🎁</span>
          <span>兑换商店</span>
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[55] flex items-end justify-center p-2.5 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="关闭兑换"
            className={`ui-modal-backdrop absolute inset-0 transition-opacity duration-300 ${
              sheetEnter ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeShop}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`ui-sheet relative flex h-[78dvh] w-full max-w-lg flex-col overflow-hidden px-4 pt-3 transition-all duration-300 ease-out will-change-transform ${
              sheetEnter
                ? "translate-y-0 opacity-100 sm:scale-100"
                : "translate-y-full opacity-90 sm:translate-y-2 sm:scale-95"
            } pb-[max(1.25rem,env(safe-area-inset-bottom))]`}
          >
            <div className="ui-sheet-handle mx-auto mb-3 h-1 w-10 rounded-full" aria-hidden />

            <div className="ui-soft-panel ui-card-compact relative overflow-hidden">
              <div
                aria-hidden
                className="ui-ambient-white pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full blur-xl"
              />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2
                    id={titleId}
                    className="mt-0.5 text-base font-extrabold ui-text-main"
                  >
                    🎁 恋爱宝库
                  </h2>
                  <p className="mt-0.5 text-[11px] font-medium ui-text-soft">
                    把每天的认真，换成小小奖励
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {mode === "browse" ? (
                    <button
                      type="button"
                      onClick={() => setMode("manage")}
                      className="ui-button-secondary px-3 py-1 text-xs font-semibold"
                    >
                      管理类别
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={closeCategoryMode}
                      className="ui-button-secondary px-3 py-1 text-xs font-semibold"
                    >
                      返回
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeShop}
                    className="ui-button-secondary px-3 py-1 text-xs font-semibold"
                  >
                    收起
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="ui-badge ui-chip-primary py-1 text-[11px]">
                  <span aria-hidden>💎</span>
                  {gemStock}/{GEM_CAP}
                </span>
                <span className="ui-badge ui-chip-reward py-1 text-[11px]">
                  <span aria-hidden>🪙</span>
                  {coinStock}
                </span>
              </div>
            </div>

            {mode === "browse" ? renderBrowseList() : renderManageList()}

            {renderOverlay()}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          className="ui-dialog pointer-events-none fixed bottom-[max(5.5rem,env(safe-area-inset-bottom))] left-1/2 z-[60] w-[min(92vw,22rem)] -translate-x-1/2 px-4 py-3 text-center text-xs font-semibold leading-relaxed ui-text-main"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}

