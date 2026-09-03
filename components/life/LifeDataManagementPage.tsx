"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { useStaleQuery } from "@/lib/client/use-stale-query";
import {
  createLifeBackup,
  exportLifeData,
  fetchLifeBackups,
  importLifeBackup,
  restoreLifeBackup,
  type LifeBackupSnapshot,
} from "@/lib/life/data-management-client";

const RESTORE_CONFIRMATION = "确认恢复生活数据";

type PendingAction =
  | { kind: "restore"; snapshot: LifeBackupSnapshot }
  | { kind: "import"; name: string; data: Record<string, unknown> };

function formatDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
function reasonLabel(reason: LifeBackupSnapshot["reason"]) {
  if (reason === "manual") return "手动备份";
  if (reason === "scheduled") return "自动备份";
  if (reason === "pre_restore") return "恢复前保护点";
  return "导入备份";
}
function scopeLabel(scope: LifeBackupSnapshot["scope"]) {
  if (scope === "full") return "完整数据";
  if (scope === "config") return "设置";
  return "生活记录";
}
function actorLabel(actor: LifeBackupSnapshot["createdBy"]) {
  if (actor === "cat") return "小猫";
  if (actor === "fish") return "小鱼";
  return null;
}
function rowSummary(snapshot: LifeBackupSnapshot) {
  const counts = snapshot.rowCounts ?? {};
  const parts = [["餐食", counts.meals], ["心情", counts.moods], ["体重", counts.weights], ["药品", counts.medicines], ["信件", counts.letters]] as const;
  const available = parts.filter(([, value]) => typeof value === "number");
  return available.length ? available.map(([label, value]) => `${label} ${value}`).join(" · ") : "完整家庭快照";
}
function downloadJson(data: Record<string, unknown>) {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `couple-better-life-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LifeDataManagementPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirmation, setConfirmation] = useState("");

  const fetcher = useCallback(async () => (await fetchLifeBackups()).snapshots, []);
  const backupsQuery = useStaleQuery<LifeBackupSnapshot[]>({ key: "life-backups", fetcher, staleMs: 15_000 });
  const snapshots = backupsQuery.data ?? [];
  const lastBackup = snapshots[0] ?? null;

  async function createBackup() {
    setBusy("backup"); setToast(null);
    try {
      const result = await createLifeBackup();
      backupsQuery.update((current) => [result.snapshot, ...(current ?? []).filter((item) => item.id !== result.snapshot.id)]);
      setToast("已经保存一个新的恢复点");
    } catch (error) { setToast(error instanceof Error ? error.message : "备份失败"); }
    finally { setBusy(null); }
  }

  async function exportData() {
    setBusy("export"); setToast(null);
    try { downloadJson((await exportLifeData()).data); setToast("完整 JSON 已导出到本机"); }
    catch (error) { setToast(error instanceof Error ? error.message : "导出失败"); }
    finally { setBusy(null); }
  }

  async function pickImport(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("文件不是有效的生活数据 JSON");
      setConfirmation("");
      setPending({ kind: "import", name: file.name, data: parsed as Record<string, unknown> });
    } catch (error) { setToast(error instanceof Error ? error.message : "读取导入文件失败"); }
  }

  async function confirmDangerousAction() {
    if (!pending || confirmation !== RESTORE_CONFIRMATION) return;
    setBusy("restore"); setToast(null);
    try {
      if (pending.kind === "restore") {
        await restoreLifeBackup(pending.snapshot.id, confirmation);
        setToast(`已经恢复到 ${formatDateTime(pending.snapshot.createdAt)}；恢复前状态也自动保存了`);
      } else {
        await importLifeBackup(pending.data, confirmation);
        setToast("导入完成；导入前状态也自动保存了");
      }
      setPending(null); setConfirmation("");
      await backupsQuery.refresh(true);
    } catch (error) { setToast(error instanceof Error ? error.message : "恢复失败"); }
    finally { setBusy(null); }
  }

  return (
    <>
      <AppPageShell title="数据管理" subtitle="备份、导出、导入和恢复。" actions={<Link href="/me" className="life-back-link">返回我的</Link>}>
        <div className="life-data-page">
          <section className="life-data-hero">
            <div className="life-data-hero-icon" aria-hidden>☁︎</div>
            <div className="min-w-0">
              <p className="text-sm font-black text-[var(--life-text)]">生活数据保护</p>
              <p className="mt-1 text-[10px] leading-5 text-[var(--life-text-muted)]">{lastBackup ? `最近恢复点：${formatDateTime(lastBackup.createdAt)}` : "还没有恢复点"}</p>
            </div>
          </section>

          <section className="life-data-action-grid" aria-label="数据管理操作">
            <button type="button" className="life-data-action" disabled={Boolean(busy)} onClick={() => void createBackup()}><span aria-hidden>🛟</span><strong>{busy === "backup" ? "备份中…" : "立即备份"}</strong><small>创建恢复点</small></button>
            <button type="button" className="life-data-action" disabled={Boolean(busy)} onClick={() => void exportData()}><span aria-hidden>⇩</span><strong>{busy === "export" ? "导出中…" : "导出 JSON"}</strong><small>下载到本机</small></button>
            <button type="button" className="life-data-action" disabled={Boolean(busy)} onClick={() => fileInputRef.current?.click()}><span aria-hidden>⇧</span><strong>导入 JSON</strong><small>从备份恢复</small></button>
          </section>

          <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void pickImport(file); }} />
          {toast ? <div className="rounded-[14px] bg-[var(--life-surface-soft)] px-3 py-2 text-[10px] leading-5 text-[var(--life-text-body)]">{toast}</div> : null}
          {backupsQuery.error ? <div className="rounded-[14px] bg-[color:color-mix(in_srgb,var(--life-coral)_14%,white)] px-3 py-2 text-[10px] text-[var(--life-danger)]">{backupsQuery.error.message}</div> : null}

          <section>
            <div className="mb-2 flex items-end justify-between gap-3"><h2 className="text-sm font-black text-[var(--life-text)]">恢复点</h2>{backupsQuery.loading ? <span className="text-[10px] text-[var(--life-text-muted)]">读取中…</span> : null}</div>
            <div className="life-backup-list">
              {snapshots.length ? snapshots.slice(0, 20).map((snapshot) => {
                const creator = actorLabel(snapshot.createdBy);
                return <div key={snapshot.id} className="life-backup-row"><div className="min-w-0"><strong>{formatDateTime(snapshot.createdAt)} · {reasonLabel(snapshot.reason)}</strong><p>{scopeLabel(snapshot.scope)} · {rowSummary(snapshot)}{creator ? ` · ${creator}` : ""}</p></div><button type="button" className="life-backup-restore" disabled={Boolean(busy)} onClick={() => { setConfirmation(""); setPending({ kind: "restore", snapshot }); }}>恢复</button></div>;
              }) : <div className="px-3 py-5 text-center text-xs text-[var(--life-text-muted)]">还没有恢复点</div>}
            </div>
          </section>
        </div>
      </AppPageShell>

      {pending ? (
        <div className="life-sheet-backdrop" role="presentation" onMouseDown={() => busy !== "restore" && setPending(null)}>
          <section className="life-mood-sheet" role="dialog" aria-modal="true" aria-labelledby="life-data-confirm-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--life-border)]" />
            <h2 id="life-data-confirm-title" className="text-center text-lg font-black text-[var(--life-text)]">{pending.kind === "restore" ? "恢复这个生活数据？" : "导入这份生活数据？"}</h2>
            <p className="mt-2 text-center text-xs leading-5 text-[var(--life-text-muted)]">{pending.kind === "restore" ? `${formatDateTime(pending.snapshot.createdAt)} · ${reasonLabel(pending.snapshot.reason)}` : pending.name}</p>
            <div className="mt-4 rounded-[15px] bg-[var(--life-surface-soft)] p-3 text-[10px] leading-5 text-[var(--life-text-body)]">操作前会自动保存当前状态。</div>
            <label className="mt-4 grid gap-1.5 text-xs font-bold text-[var(--life-text-body)]">输入“{RESTORE_CONFIRMATION}”继续<AppInput value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={RESTORE_CONFIRMATION} /></label>
            <div className="mt-4 grid grid-cols-2 gap-2"><AppButton variant="secondary" disabled={busy === "restore"} onClick={() => setPending(null)}>取消</AppButton><AppButton variant="primary" disabled={busy === "restore" || confirmation !== RESTORE_CONFIRMATION} onClick={() => void confirmDangerousAction()}>{busy === "restore" ? "处理中…" : "确认恢复"}</AppButton></div>
          </section>
        </div>
      ) : null}
    </>
  );
}
