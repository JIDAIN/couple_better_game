"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";
import { AppPageShell } from "@/components/ui/AppPageShell";
import {
  actOnLifeReminder,
  createLifeReminder,
  effectiveReminderTime,
  fetchLifeReminderSettings,
  fetchLifeReminders,
  saveLifeReminderSettings,
  type LifeReminderItem,
  type LifeReminderSettings,
} from "@/lib/life/reminder-client";

const MEDICINE_OFFSET_OPTIONS = [30, 14, 7, 3, 1, 0] as const;

function dateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function reminderTimeText(item: LifeReminderItem) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(effectiveReminderTime(item)));
}

function sourceLabel(sourceKind: LifeReminderItem["sourceKind"]) {
  if (sourceKind === "medicine") return "药箱";
  if (sourceKind === "anniversary") return "纪念日";
  if (sourceKind === "system") return "系统";
  return "自定义";
}

function offsetLabel(value: number) {
  return value === 0 ? "当天" : `提前 ${value} 天`;
}

function ReminderItemCard({
  item,
  busy,
  onAction,
  onDisableMedicine,
}: {
  item: LifeReminderItem;
  busy: boolean;
  onAction: (item: LifeReminderItem, action: "complete" | "dismiss" | "snooze") => void;
  onDisableMedicine: () => void;
}) {
  return (
    <article className="rounded-2xl bg-white/65 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-[var(--life-text)]">{item.title}</p>
          {item.content ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--life-text-body)]">
              {item.content}
            </p>
          ) : null}
          <p className="mt-1.5 text-[10px] font-bold text-[var(--life-text-muted)]">
            {reminderTimeText(item)} · {sourceLabel(item.sourceKind)}
            {item.status === "snoozed" ? " · 已稍后提醒" : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--life-surface-soft)] px-2 py-1 text-[10px] font-extrabold text-[var(--life-teal-strong)]">
          {sourceLabel(item.sourceKind)}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction(item, "complete")}
          className="text-xs font-extrabold text-[var(--life-teal-strong)] disabled:opacity-40"
        >
          完成
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction(item, "snooze")}
          className="text-xs font-bold text-[var(--life-text-muted)] disabled:opacity-40"
        >
          1 小时后
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction(item, "dismiss")}
          className="text-xs font-bold text-[var(--life-text-muted)] disabled:opacity-40"
        >
          忽略
        </button>
        {item.sourceKind === "medicine" ? (
          <button
            type="button"
            disabled={busy}
            onClick={onDisableMedicine}
            className="text-xs font-bold text-[var(--life-danger)] disabled:opacity-40"
          >
            关闭药箱提醒
          </button>
        ) : null}
      </div>
    </article>
  );
}

function ReminderSection({
  title,
  items,
  emptyText,
  busyId,
  onAction,
  onDisableMedicine,
}: {
  title: string;
  items: LifeReminderItem[];
  emptyText: string;
  busyId: string | null;
  onAction: (item: LifeReminderItem, action: "complete" | "dismiss" | "snooze") => void;
  onDisableMedicine: () => void;
}) {
  return (
    <section className="life-surface rounded-[var(--life-radius-card)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-extrabold text-[var(--life-text)]">{title}</p>
        {items.length ? (
          <span className="text-[10px] font-bold text-[var(--life-text-muted)]">{items.length} 条</span>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2">
        {items.length ? (
          items.map((item) => (
            <ReminderItemCard
              key={item.id}
              item={item}
              busy={busyId === item.id}
              onAction={onAction}
              onDisableMedicine={onDisableMedicine}
            />
          ))
        ) : (
          <p className="text-xs text-[var(--life-text-muted)]">{emptyText}</p>
        )}
      </div>
    </section>
  );
}

export function LifeReminderCenterPage() {
  const { currentPartnerKey } = useLifeIdentity();
  const [items, setItems] = useState<LifeReminderItem[]>([]);
  const [settings, setSettings] = useState<LifeReminderSettings | null>(null);
  const [medicineOffsets, setMedicineOffsets] = useState<number[]>([]);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [scope, setScope] = useState<"cat" | "fish" | "both">("both");
  const [creating, setCreating] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [nextItems, nextSettings] = await Promise.all([
      fetchLifeReminders(),
      fetchLifeReminderSettings(),
    ]);
    setItems(nextItems);
    setSettings(nextSettings);
    setMedicineOffsets(nextSettings.medicineOffsets);
  }, []);

  useEffect(() => {
    void load().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "读取提醒失败");
    });
  }, [load]);

  const groups = useMemo(() => {
    const today = dateKey(new Date());
    const active = items
      .filter((item) => item.status === "pending" || item.status === "snoozed")
      .sort(
        (a, b) =>
          new Date(effectiveReminderTime(a)).getTime() -
          new Date(effectiveReminderTime(b)).getTime(),
      );
    return {
      today: active.filter((item) => dateKey(effectiveReminderTime(item)) <= today),
      upcoming: active.filter((item) => dateKey(effectiveReminderTime(item)) > today),
      completed: items
        .filter((item) => item.status === "completed")
        .sort(
          (a, b) =>
            new Date(b.completedAt || b.dueAt).getTime() -
            new Date(a.completedAt || a.dueAt).getTime(),
        ),
    };
  }, [items]);

  async function createReminder() {
    if (!title.trim() || !due) return;
    setCreating(true);
    setError("");
    setNotice("");
    try {
      await createLifeReminder({
        recipientScope: scope,
        title: title.trim(),
        dueAt: new Date(due).toISOString(),
      });
      setTitle("");
      setDue("");
      setNotice("提醒已添加。");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "创建提醒失败");
    } finally {
      setCreating(false);
    }
  }

  async function act(
    item: LifeReminderItem,
    action: "complete" | "dismiss" | "snooze",
  ) {
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      const snoozeUntil =
        action === "snooze"
          ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
          : null;
      await actOnLifeReminder(item.id, action, snoozeUntil);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "提醒操作失败");
    } finally {
      setBusyId(null);
    }
  }

  function toggleMedicineOffset(value: number) {
    setMedicineOffsets((current) => {
      if (current.includes(value)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== value);
      }
      return [...current, value].sort((a, b) => b - a);
    });
  }

  async function saveMedicineSettings(enabled = settings?.medicineReminderEnabled ?? true) {
    if (!settings || !medicineOffsets.length) return;
    setSavingSettings(true);
    setError("");
    setNotice("");
    try {
      const next = await saveLifeReminderSettings({
        medicineReminderEnabled: enabled,
        medicineOffsets,
      });
      setSettings(next);
      setMedicineOffsets(next.medicineOffsets);
      setNotice(enabled ? "药箱提醒设置已保存。" : "药箱提醒已关闭。");
      setItems(await fetchLifeReminders());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存提醒设置失败");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <AppPageShell title="提醒中心" subtitle="只提醒真正需要记住的小事。">
      <div className="grid gap-3">
        <section className="life-surface rounded-[var(--life-radius-card)] p-4">
          <p className="text-sm font-extrabold text-[var(--life-text)]">新建提醒</p>
          <div className="mt-3 grid gap-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：交水费"
              className="rounded-2xl border border-[var(--life-border-soft)] bg-white/80 px-3.5 py-3 text-sm outline-none focus:border-[var(--life-teal)]"
            />
            <input
              type="datetime-local"
              value={due}
              onChange={(event) => setDue(event.target.value)}
              className="rounded-2xl border border-[var(--life-border-soft)] bg-white/80 px-3.5 py-3 text-sm outline-none focus:border-[var(--life-teal)]"
            />
            <div className="flex flex-wrap gap-2">
              {(["cat", "fish", "both"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScope(value)}
                  className={`rounded-full px-3 py-2 text-xs font-bold ${
                    scope === value
                      ? "bg-[var(--life-teal)] text-white"
                      : "bg-white/70 text-[var(--life-text-body)]"
                  }`}
                >
                  {value === "cat" ? "小猫" : value === "fish" ? "小鱼" : "两个人"}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={creating || !title.trim() || !due}
              onClick={() => void createReminder()}
              className="rounded-full bg-[var(--life-teal)] px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-40"
            >
              {creating ? "保存中…" : "添加提醒"}
            </button>
          </div>
        </section>

        {error ? (
          <p className="rounded-2xl bg-[color:color-mix(in_srgb,var(--life-coral)_14%,white)] px-3 py-2.5 text-xs font-bold text-[var(--life-danger)]">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-2xl bg-[var(--life-surface-soft)] px-3 py-2.5 text-xs font-bold text-[var(--life-teal-strong)]">
            {notice}
          </p>
        ) : null}

        <ReminderSection
          title="今天"
          items={groups.today}
          emptyText="今天没有需要处理的提醒。"
          busyId={busyId}
          onAction={(item, action) => void act(item, action)}
          onDisableMedicine={() => void saveMedicineSettings(false)}
        />
        <ReminderSection
          title="即将到来"
          items={groups.upcoming}
          emptyText="暂时没有后面的提醒。"
          busyId={busyId}
          onAction={(item, action) => void act(item, action)}
          onDisableMedicine={() => void saveMedicineSettings(false)}
        />

        <section className="life-surface rounded-[var(--life-radius-card)] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-extrabold text-[var(--life-text)]">已完成</p>
            {groups.completed.length ? (
              <span className="text-[10px] font-bold text-[var(--life-text-muted)]">
                {groups.completed.length} 条
              </span>
            ) : null}
          </div>
          <div className="mt-3 grid gap-2">
            {groups.completed.length ? (
              groups.completed.map((item) => (
                <article key={item.id} className="rounded-2xl bg-white/55 p-3 opacity-75">
                  <p className="text-sm font-bold text-[var(--life-text)]">✓ {item.title}</p>
                  <p className="mt-1 text-[10px] text-[var(--life-text-muted)]">
                    {reminderTimeText(item)} · {sourceLabel(item.sourceKind)}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-xs text-[var(--life-text-muted)]">还没有完成过提醒。</p>
            )}
          </div>
        </section>

        <section className="life-surface rounded-[var(--life-radius-card)] p-4">
          <p className="text-sm font-extrabold text-[var(--life-text)]">提醒设置</p>
          {settings ? (
            <div className="mt-3 grid gap-4">
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/60 p-3">
                <div>
                  <p className="text-xs font-extrabold text-[var(--life-text)]">PushPlus 微信</p>
                  <p className="mt-1 text-[10px] text-[var(--life-text-muted)]">
                    {settings.pushPlusConfigured ? "当前账号已绑定" : "当前账号还未绑定"}
                  </p>
                </div>
                <Link href="/me" className="text-xs font-extrabold text-[var(--life-teal-strong)]">
                  {settings.pushPlusConfigured ? "管理" : "去绑定"}
                </Link>
              </div>

              <div className="rounded-2xl bg-white/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-extrabold text-[var(--life-text)]">药箱到期提醒</p>
                    <p className="mt-1 text-[10px] text-[var(--life-text-muted)]">
                      只影响当前账号；最多提前 90 天。
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={savingSettings}
                    onClick={() =>
                      void saveMedicineSettings(!settings.medicineReminderEnabled)
                    }
                    className={`rounded-full px-3 py-2 text-xs font-extrabold ${
                      settings.medicineReminderEnabled
                        ? "bg-[var(--life-teal)] text-white"
                        : "bg-[var(--life-surface-soft)] text-[var(--life-text-muted)]"
                    }`}
                  >
                    {settings.medicineReminderEnabled ? "已开启" : "已关闭"}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {MEDICINE_OFFSET_OPTIONS.map((value) => {
                    const selected = medicineOffsets.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={savingSettings || !settings.medicineReminderEnabled}
                        onClick={() => toggleMedicineOffset(value)}
                        className={`rounded-full px-3 py-2 text-[10px] font-bold disabled:opacity-40 ${
                          selected
                            ? "bg-[var(--life-surface-soft)] text-[var(--life-teal-strong)] ring-1 ring-[var(--life-teal)]"
                            : "bg-white/70 text-[var(--life-text-muted)]"
                        }`}
                      >
                        {offsetLabel(value)}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={
                    savingSettings ||
                    !settings.medicineReminderEnabled ||
                    !medicineOffsets.length
                  }
                  onClick={() => void saveMedicineSettings(true)}
                  className="mt-3 rounded-full border border-[var(--life-border-soft)] bg-white/75 px-4 py-2 text-xs font-extrabold text-[var(--life-text)] disabled:opacity-40"
                >
                  {savingSettings ? "保存中…" : "保存提前天数"}
                </button>
              </div>

              <div className="rounded-2xl bg-white/60 p-3">
                <p className="text-xs font-extrabold text-[var(--life-text)]">纪念日提醒</p>
                <p className="mt-1 text-[10px] leading-4 text-[var(--life-text-muted)]">
                  {settings.anniversaryReminderEnabled
                    ? `已开启 · ${settings.anniversaryOffsets.map(offsetLabel).join("、")}`
                    : "已关闭"}
                  。纪念日现在也会出现在提醒中心。
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-[var(--life-text-muted)]">正在读取提醒设置…</p>
          )}
        </section>

        <p className="px-1 text-center text-[10px] leading-4 text-[var(--life-text-muted)]">
          微信提醒由云端每 5 分钟检查一次，不需要保持网页打开。
          {currentPartnerKey ? " 当前页面只展示当前账号自己的提醒实例。" : ""}
        </p>
      </div>
    </AppPageShell>
  );
}
