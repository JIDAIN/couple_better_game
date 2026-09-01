"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Tabs, Title } from "animal-island-ui";
import { AppButton, AppCard, AppCurrencyChip, AppGameIcon, AppInput, AppModal, AppTextarea, AppToast } from "../ui";
import {
  GEM_CAP,
  useHomeResources,
  type ExchangeCategory,
  type ExchangeRecord,
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
  resourceKind: "coin",
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

function ShopBalanceChip({
  icon,
  label,
  value,
}: {
  icon: "gem" | "coin";
  label: string;
  value: string | number;
}) {
  return (
    <span className="shop-balance-chip">
      <AppGameIcon name={icon} size={14} />
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}

function formatExchangeDisplayDate(value: string) {
  return value.replace(/\s+\d{2}:\d{2}$/, "");
}

function ExchangeRecordCard({
  record,
  onEdit,
}: {
  record: ExchangeRecord;
  onEdit: (recordId: string) => void;
}) {
  return (
    <article className="record-item exchange-record-item">
      <div className="exchange-record-top">
        <span className="exchange-record-date">
          {formatExchangeDisplayDate(record.date)}
        </span>

        <AppButton
          type="button"
          onClick={() => onEdit(record.id)}
          size="small"
          className="exchange-edit-button"
        >
          编辑
        </AppButton>
      </div>

      <div className="exchange-record-line">
        <span className="exchange-record-title">
          {record.icon} {record.category}
          {record.remark ? ` · ${record.remark}` : ""}
        </span>

        <AppCurrencyChip
          currency={record.resourceKind}
          value={record.price}
          showSign={false}
          size="sm"
          className="exchange-record-price"
        />
      </div>
    </article>
  );
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

export function ExchangeShop({
  variant = "sheet",
}: {
  variant?: "sheet" | "inline";
}) {
  const inline = variant === "inline";
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
  const [toast, setToast] = useState<string | null>(null);
  const [mode, setMode] = useState<"browse" | "manage">("browse");
  const [overlay, setOverlay] = useState<OverlayState>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(
    EMPTY_CATEGORY_FORM,
  );
  const [recordForm, setRecordForm] = useState<RecordFormState>(
    EMPTY_RECORD_FORM,
  );
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
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
    setOverlay(null);
    setRecordForm(EMPTY_RECORD_FORM);
    setEditingRecordId(null);
    setCategoryForm(EMPTY_CATEGORY_FORM);
  }, []);

  const openOverlay = useCallback((next: OverlayState) => {
    setOverlay(next);
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
    setOpen(false);
  }, [closeOverlay]);

  const openShop = useCallback(() => {
    closeOverlay();
    setMode("browse");
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
    if (!open || inline) return;
    const prev = document.body.style.overflow;
    prevOverflow.current = prev;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow.current ?? "";
    };
  }, [open, inline]);

  useEffect(() => {
    if (!open || inline) return;
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
  }, [open, overlay, mode, closeOverlay, closeCategoryMode, closeShop, inline]);

  useEffect(() => {
    if (!inline) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (overlay) {
        closeOverlay();
        return;
      }
      if (mode === "manage") {
        closeCategoryMode();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inline, overlay, mode, closeOverlay, closeCategoryMode]);

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
    const coinCategories = categories.filter(
      (category) => category.resourceKind === "coin",
    );
    const gemCategories = categories.filter(
      (category) => category.resourceKind === "gem",
    );

    const renderCategoryCard = (category: ExchangeCategory) => {
      const affordable = canAfford(category);
      return (
        <AppCard
          variant="item"
          key={category.id}
          className="shop-shelf-item"
        >
          <div className="shop-shelf-row">
            <div className="shop-shelf-main">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center text-base"
                aria-hidden
              >
                {category.icon}
              </span>
              <div className="min-w-0">
                <p className="shop-shelf-title ui-text-main">
                  {category.title}
                </p>
              </div>
            </div>

            <div className="shop-shelf-action">
              <AppCurrencyChip currency={category.resourceKind} value={category.price} size="sm" showSign={false} />
              <AppButton
                type="button"
                disabled={!affordable}
                onClick={() => openRecord(category.id)}
                size="small"
                className="shrink-0 self-center text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45"
              >
                {affordable ? "兑换" : "差一点"}
              </AppButton>
            </div>
          </div>
        </AppCard>
      );
    };

    const renderSection = (title: React.ReactNode, kind: ResourceKind, items: ExchangeCategory[]) => (
      <AppCard variant="panel" className="shop-shelf-section">
        <div className="shop-shelf-header">
          <p
            className={`text-sm font-bold tracking-wide ${
              kind === "gem" ? "ui-text-primary" : "ui-text-reward"
            }`}
          >
            {title}
          </p>
        </div>
        {items.length > 0 ? (
          <div className="shop-shelf-list">{items.map(renderCategoryCard)}</div>
        ) : (
          <AppCard variant="item" className="shop-shelf-empty text-center text-[11px] font-semibold ui-text-soft">
            {kind === "gem" ? "还没有宝石商品" : "还没有金币商品"}
          </AppCard>
        )}
      </AppCard>
    );

    return (
      <div
        className={
          inline
            ? "shop-list-scroll mt-2.5 space-y-2"
            : "shop-list-scroll mt-2.5 min-h-0 flex-1 overflow-y-auto overscroll-contain"
        }
      >
        <Tabs
          items={[
            {
              key: "coin",
              label: "金币兑换",
              children: renderSection(<><AppGameIcon name="coin" size={16} /> 金币兑换</>, "coin", coinCategories),
            },
            {
              key: "gem",
              label: "宝石兑换",
              children: renderSection(<><AppGameIcon name="gem" size={16} /> 宝石兑换</>, "gem", gemCategories),
            },
          ]}
          defaultActiveKey="coin"
        />

        <AppCard variant="panel" className="shop-shelf-section mt-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="px-1 text-[11px] font-semibold tracking-wide ui-text-muted">
              已兑换记录
            </p>
            <AppButton
              type="button"
              onClick={openHistory}
              className="px-3 py-1.5 text-[11px] font-semibold"
            >
              查看记录
            </AppButton>
          </div>
          {exchangeRecords.length > 0 ? (
            <div className="space-y-1.5">
              {exchangeRecords.slice(0, 3).map((record) => (
                <ExchangeRecordCard
                  key={record.id}
                  record={record}
                  onEdit={openEditRecord}
                />
              ))}
            </div>
          ) : (
            <AppCard variant="item" className="shop-shelf-empty text-[11px] font-medium ui-text-soft">
              还没有兑换记录，攒到喜欢的奖励再来换吧。
            </AppCard>
          )}
        </AppCard>
      </div>
    );
  };

  const renderManageList = () => {
    const coinCategories = categories.filter(
      (category) => category.resourceKind === "coin",
    );
    const gemCategories = categories.filter(
      (category) => category.resourceKind === "gem",
    );

    const renderCategoryCard = (category: ExchangeCategory) => (
      <AppCard
        variant="item"
        key={category.id}
        className="shop-shelf-item"
      >
        <div className="shop-shelf-row">
          <div className="shop-shelf-main">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center text-base"
              aria-hidden
            >
              {category.icon}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold ui-text-main">
                {category.title}
              </p>
              <p className="mt-0.5 line-clamp-1 text-[10px] font-medium ui-text-soft">
                {category.description}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <AppButton type="button" size="small" disabled className="py-0.5 text-[10px]">
                  {resourceLabel(category.resourceKind)}
                </AppButton>
                <AppCurrencyChip currency={category.resourceKind} value={category.price} size="sm" showSign={false} />
              </div>
            </div>
          </div>
          <div className="shop-shelf-action">
            <AppButton
              type="button"
              onClick={() => openCategoryForm(category.id)}
              className="px-3 py-1.5 text-[11px] font-semibold"
            >
              编辑
            </AppButton>
            <AppButton
              type="button"
              onClick={() => deleteCategory(category.id)}
              className="px-3 py-1.5 text-[11px] font-semibold opacity-80"
            >
              删除
            </AppButton>
          </div>
        </div>
      </AppCard>
    );

    const renderSection = (title: React.ReactNode, items: ExchangeCategory[]) => (
      <AppCard variant="panel" className="shop-shelf-section">
        <div className="shop-shelf-header">
          <p className="text-[11px] font-semibold tracking-wide ui-text-muted">
            {title}
          </p>
          <span className="text-[10px] font-semibold ui-text-soft">
            {items.length} 项
          </span>
        </div>
        <div className="shop-shelf-list">
          {items.map(renderCategoryCard)}
        </div>
      </AppCard>
    );

    return (
      <div
        className={
          inline
            ? "shop-list-scroll mt-2.5 space-y-2"
            : "shop-list-scroll mt-2.5 min-h-0 flex-1 overflow-y-auto overscroll-contain"
        }
      >
        <div className="flex items-center justify-between gap-3">
          <p className="px-1 text-[11px] font-semibold tracking-wide ui-text-muted">
            奖励模板
          </p>
          <AppButton
            type="button"
            onClick={() => openCategoryForm(null)}
            className="px-3 py-1.5 text-xs font-semibold"
          >
            新增类别
          </AppButton>
        </div>

        <div className="mt-2 space-y-3">
          {renderSection("金币类", coinCategories)}
          {renderSection("宝石类", gemCategories)}
        </div>
      </div>
    );
  };
  const renderOverlay = () => {
    if (!overlay) return null;

    if (overlay.kind === "history") {
      return (
        <AppModal
          open
          onClose={closeOverlay}
          maskClosable
          width="min(92vw, 28rem)"
          title={
            <div className="app-dialog-header">
              <Title size="small" color="app-yellow">
                兑换记录
              </Title>
              <p className="mt-0.5 text-[11px] font-medium ui-text-soft">
                最近的小奖励都在这里
              </p>
            </div>
          }
          footer={
            <div className="app-dialog-footer">
              <AppButton
                type="button"
                onClick={closeOverlay}
                className="is-secondary flex-1 py-3 text-sm font-semibold"
              >
                返回
              </AppButton>
            </div>
          }
        >
          <div className="app-modal-scroll-body app-modal-scroll-body--records">
            {exchangeRecords.length > 0 ? (
              <div className="record-list">
                {exchangeRecords.map((record) => (
                  <ExchangeRecordCard
                    key={record.id}
                    record={record}
                    onEdit={openEditRecord}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-[12rem] items-center justify-center py-8 text-center text-sm font-semibold ui-text-muted">
                还没有兑换记录，攒到喜欢的小奖励再来换吧。
              </div>
            )}
          </div>
        </AppModal>
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
        <AppModal
          open
          onClose={closeOverlay}
          maskClosable
          width="min(92vw, 26rem)"
          title={
            <div className="app-dialog-header">
              <div>
                <p className="text-[11px] font-semibold tracking-wide ui-text-soft">
                  {isEditing ? "编辑兑换记录" : "记录兑换"}
                </p>
                <Title size="small" color="app-yellow" className="mt-0.5">
                  {displayIcon} {displayTitle}
                </Title>
              </div>
            </div>
          }
          footer={
            <div className="app-dialog-footer">
              {isEditing ? (
                <AppButton
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (!record) return;
                    const ok = deleteExchangeRecord(record.id);
                    if (ok) {
                      setToast("已删除兑换记录");
                      closeOverlay();
                    }
                  }}
                  className="flex-1 py-2.5 text-sm font-semibold"
                >
                  删除
                </AppButton>
              ) : null}
              <AppButton
                type="button"
                onClick={closeOverlay}
                className="is-secondary flex-1 py-2.5 text-sm font-semibold"
              >
                取消
              </AppButton>
              <AppButton
                type="button"
                onClick={saveExchangeRecord}
                disabled={!canSubmit}
                className="is-primary flex-[1.3] py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isEditing ? "保存修改" : "确认兑换"}
              </AppButton>
            </div>
          }
        >
          <div className="app-modal-scroll-body app-modal-scroll-body--form-compact">
            <div className="flex flex-wrap gap-1.5">
              <AppButton type="button" size="small" disabled className="py-1 text-[11px]">
                {resourceLabel(displayResource)}
              </AppButton>
              <AppCurrencyChip currency={displayResource} value={displayPrice} size="sm" showSign={false} />
            </div>

            <label className="mt-2.5 block">
              <span className="ui-field-label">
                时间
              </span>
              <AppInput
                type="datetime-local"
                value={recordForm.occurredAt}
                onChange={(e) =>
                  setRecordForm((current) => ({
                    ...current,
                    occurredAt: e.target.value,
                  }))
                }
                className="app-input mt-1 w-full px-3 py-2.5 text-sm font-semibold outline-none"
              />
            </label>

            <label className="mt-2.5 block">
              <span className="ui-field-label">
                备注
              </span>
              <AppInput
                value={recordForm.remark}
                onChange={(e) =>
                  setRecordForm((current) => ({
                    ...current,
                    remark: e.target.value,
                  }))
                }
                className="app-input mt-1 w-full px-3 py-2.5 text-sm font-semibold outline-none"
                placeholder="例如：下午茶 / 小奖励 / 周末加餐"
              />
            </label>
          </div>
        </AppModal>
      );
    }

    if (overlay.kind === "category") {
      const isEdit = overlay.categoryId != null;

      return (
        <AppModal
          open
          onClose={closeOverlay}
          maskClosable
          width="min(92vw, 27rem)"
          title={
            <div className="app-dialog-header">
              <div>
                <p className="text-[11px] font-semibold tracking-wide ui-text-soft">
                  {isEdit ? "编辑类别" : "新增类别"}
                </p>
                <Title size="small" color="app-yellow" className="mt-0.5">
                  {isEdit ? "修改一个小奖励模板" : "添加一个新的小奖励模板"}
                </Title>
              </div>
            </div>
          }
          footer={
            <div className="app-dialog-footer">
              <AppButton
                type="button"
                onClick={closeOverlay}
                className="is-secondary flex-1 py-2.5 text-sm font-semibold"
              >
                取消
              </AppButton>
              <AppButton
                type="button"
                onClick={saveCategory}
                className="is-primary flex-[1.3] py-2.5 text-sm font-semibold"
              >
                保存类别
              </AppButton>
            </div>
          }
        >
          <div className="app-modal-scroll-body app-modal-scroll-body--form-compact">
            <div className="space-y-2.5">
              <label className="block">
                <span className="ui-field-label">
                  类别名称
                </span>
                <AppInput
                  value={categoryForm.title}
                  onChange={(e) =>
                    setCategoryForm((current) => ({
                      ...current,
                      title: e.target.value,
                    }))
                  }
                  className="app-input mt-1 w-full px-3 py-2.5 text-sm font-semibold outline-none"
                  placeholder="例如：小零食"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[6rem_minmax(0,1fr)]">
                <label className="block">
                  <span className="ui-field-label">
                    图标
                  </span>
                  <AppInput
                    value={categoryForm.icon}
                    onChange={(e) =>
                      setCategoryForm((current) => ({
                        ...current,
                        icon: e.target.value,
                      }))
                    }
                    className="app-input mt-1 w-full px-3 py-2.5 text-sm font-semibold outline-none"
                    placeholder="🍦"
                  />
                </label>

                <label className="block">
                  <span className="ui-field-label">
                    消耗资源
                  </span>
                  <div className="mt-1 flex gap-2">
                    <AppButton
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
                    </AppButton>
                    <AppButton
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
                    </AppButton>
                  </div>
                </label>
              </div>

              <label className="block">
                <span className="ui-field-label">
                  消耗数量
                </span>
                <div className="mt-1">
                  <AppInput
                    value={categoryForm.price}
                    onChange={(e) =>
                      setCategoryForm((current) => ({
                        ...current,
                        price: e.target.value,
                      }))
                    }
                    inputMode="numeric"
                    className="w-full text-sm font-semibold"
                    placeholder="5"
                    suffix={resourceLabel(categoryForm.resourceKind)}
                  />
                </div>
              </label>

              <label className="block">
                <span className="ui-field-label">
                  描述
                </span>
                <AppTextarea
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm((current) => ({
                      ...current,
                      description: e.target.value,
                    }))
                  }
                  rows={3}
                  className="app-input mt-1 w-full resize-none px-3 py-2.5 text-sm font-medium outline-none"
                  placeholder="简单写一句这个奖励为什么可爱"
                />
              </label>
            </div>
          </div>
        </AppModal>
      );
    }

    return null;
  };

  const shopHeader = (
    <AppCard variant="panel" className="shop-signboard relative overflow-hidden">
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          {!inline ? (
              <Title
                size="small"
                color="app-yellow"
                className="mt-0.5"
              >
                <span aria-hidden><AppGameIcon name="shop" size={18} /></span> 兑换商店
              </Title>
          ) : null}
          <div className="shop-balance-row">
            <ShopBalanceChip icon="coin" label="金币" value={`${coinStock}/${GEM_CAP}`} />
            <ShopBalanceChip icon="gem" label="宝石" value={gemStock} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {mode === "browse" ? (
            <AppButton
              type="button"
              onClick={() => setMode("manage")}
              className="px-3 py-1 text-xs font-semibold"
            >
              管理类别
            </AppButton>
          ) : (
            <AppButton
              type="button"
              onClick={closeCategoryMode}
              className="px-3 py-1 text-xs font-semibold"
            >
              返回
            </AppButton>
          )}
          {inline ? null : (
            <AppButton
              type="button"
              onClick={closeShop}
              className="px-3 py-1 text-xs font-semibold"
            >
              收起
            </AppButton>
          )}
        </div>
      </div>
    </AppCard>
  );

  const shopBody = (
    <>{mode === "browse" ? renderBrowseList() : renderManageList()}</>
  );

  if (inline) {
    return (
      <div className="flex min-h-0 flex-col gap-3">
        {shopHeader}
        {shopBody}
        {renderOverlay()}
        {toast ? (
          <AppToast
            role="status"
            className="pointer-events-none fixed bottom-[max(5.5rem,env(safe-area-inset-bottom))] left-1/2 z-[60] w-[min(92vw,22rem)] -translate-x-1/2 px-4 py-3 text-center text-xs font-semibold leading-relaxed ui-text-main"
          >
            {toast}
          </AppToast>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="w-full">
        <AppButton
          type="button"
          onClick={openShop}
          className="is-nav inline-flex w-full whitespace-nowrap text-[12px] sm:text-sm"
        >
          <AppGameIcon name="gift" size={16} />
          <span>兑换商店</span>
        </AppButton>
      </div>

      <AppModal
        open={open}
        onClose={closeShop}
        maskClosable
        width="min(92vw, 30rem)"
        footer={null}
      >
        <div className="app-modal-scroll-body app-modal-scroll-body--shop">
          {shopHeader}
          {shopBody}
        </div>
      </AppModal>

      {renderOverlay()}

      {toast ? (
        <AppToast
          role="status"
          className="pointer-events-none fixed bottom-[max(5.5rem,env(safe-area-inset-bottom))] left-1/2 z-[60] w-[min(92vw,22rem)] -translate-x-1/2 px-4 py-3 text-center text-xs font-semibold leading-relaxed ui-text-main"
        >
          {toast}
        </AppToast>
      ) : null}
    </>
  );
}

