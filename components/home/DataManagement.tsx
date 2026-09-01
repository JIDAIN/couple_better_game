"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { isReloadOverwriteBlocked } from "@/lib/home/sync-state-service";
import { useHomeResources } from "./HomeResourcesProvider";
import { AppButton, AppDialogBackdrop, AppInput, AppTextarea, AppToast } from "../ui";

type PendingImport = {
  name: string;
  content: string;
};

type ExportedFile = {
  name: string;
  content: string;
  url: string;
  type: "json" | "csv";
};

const SYNC_PASSWORD_STORAGE_KEY = "couple-better-sync-password";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function todayStamp() {
  const now = new Date();
  return `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(
    now.getDate(),
  )}-${pad2(now.getHours())}${pad2(now.getMinutes())}`;
}

function createTextFileUrl(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  return { name: filename, content, url };
}

function triggerDownload(file: Pick<ExportedFile, "name" | "url">) {
  const link = document.createElement("a");
  link.href = file.url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function readSavedSyncPassword() {
  if (typeof window === "undefined") return "";
  return (
    window.localStorage.getItem(SYNC_PASSWORD_STORAGE_KEY) ??
    window.sessionStorage.getItem(SYNC_PASSWORD_STORAGE_KEY) ??
    ""
  );
}

function saveSyncPassword(password: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SYNC_PASSWORD_STORAGE_KEY, password);
  window.sessionStorage.removeItem(SYNC_PASSWORD_STORAGE_KEY);
}

function clearSavedSyncPassword() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SYNC_PASSWORD_STORAGE_KEY);
  window.sessionStorage.removeItem(SYNC_PASSWORD_STORAGE_KEY);
}

export function DataManagement({
  variant = "button",
}: {
  variant?: "button" | "inline";
}) {
  const {
    exportBackupJson,
    exportWeeklyReviewCsv,
    importBackupJson,
    lastSyncedAt,
    reloadFromGitHub,
    syncErrorCode,
    syncErrorReason,
    syncStatus,
    syncToGitHub,
  } = useHomeResources();
  const isInline = variant === "inline";
  const [open, setOpen] = useState(false);
  const [sheetEnter, setSheetEnter] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [exportedFile, setExportedFile] = useState<ExportedFile | null>(null);
  const [syncPassword, setSyncPassword] = useState("");
  const [rememberSyncPassword, setRememberSyncPassword] = useState(false);
  const [hasSavedSyncPassword, setHasSavedSyncPassword] = useState(false);
  const [confirmReloadOverwrite, setConfirmReloadOverwrite] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const exportTextRef = useRef<HTMLTextAreaElement | null>(null);
  const titleId = useId();
  const confirmTitleId = useId();

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setSheetEnter(true)),
    );
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!open && !pendingImport) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, pendingImport]);

  useEffect(() => {
    return () => {
      if (exportedFile) URL.revokeObjectURL(exportedFile.url);
    };
  }, [exportedFile]);

  const closeSheet = () => {
    setSheetEnter(false);
    setOpen(false);
  };

  const openSheet = () => {
    const savedPassword = readSavedSyncPassword();
    setSyncPassword(savedPassword);
    setHasSavedSyncPassword(Boolean(savedPassword));
    setRememberSyncPassword(Boolean(savedPassword));
    setOpen(true);
  };

  const onExportJson = () => {
    const file = {
      ...createTextFileUrl(
        `couple-better-backup-${todayStamp()}.json`,
        exportBackupJson(),
        "application/json;charset=utf-8",
      ),
      type: "json" as const,
    };
    setExportedFile(file);
    triggerDownload(file);
    setToast("备份 JSON 已生成，下面也可以再次下载");
  };

  const onExportCsv = () => {
    const file = {
      ...createTextFileUrl(
        `couple-better-weekly-review-${todayStamp()}.csv`,
        exportWeeklyReviewCsv(),
        "text/csv;charset=utf-8",
      ),
      type: "csv" as const,
    };
    setExportedFile(file);
    triggerDownload(file);
    setToast("CSV 已生成，下面也可以再次下载");
  };

  const copyExportedFile = async () => {
    if (!exportedFile) return;
    const textArea = exportTextRef.current;
    try {
      await navigator.clipboard.writeText(exportedFile.content);
      setToast(exportedFile.type === "csv" ? "CSV 内容已复制" : "JSON 内容已复制");
      return;
    } catch {
      if (textArea) {
        textArea.focus();
        textArea.select();
        try {
          if (document.execCommand("copy")) {
            setToast(
              exportedFile.type === "csv" ? "CSV 内容已复制" : "JSON 内容已复制",
            );
            return;
          }
        } catch {}
      }
      setToast("内容已选中，请按 Ctrl+C 复制");
    }
  };

  const selectExportedText = () => {
    exportTextRef.current?.focus();
    exportTextRef.current?.select();
    setToast("内容已选中，请按 Ctrl+C 复制");
  };

  const onPickImportFile = () => {
    fileInputRef.current?.click();
  };

  const onImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const content = await file.text();
      setPendingImport({ name: file.name, content });
    } catch {
      setToast("读取文件失败，请换一个 JSON 试试");
    }
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    const result = importBackupJson(pendingImport.content);
    if (!result.ok) {
      setToast(result.reason ?? "导入失败，当前数据没有变化");
      setPendingImport(null);
      return;
    }
    setPendingImport(null);
    closeSheet();
    setToast("数据已经导入啦");
  };

  const syncBusy = syncStatus === "正在加载" || syncStatus === "正在同步";
  const syncStatusDetail =
    syncErrorReason ??
    (lastSyncedAt
      ? `上次同步：${new Date(lastSyncedAt).toLocaleString()}`
      : "还没有同步记录");

  const onReloadFromGitHub = async () => {
    const result = await reloadFromGitHub(
      confirmReloadOverwrite
        ? { force: true, allowDirtyOverwrite: true }
        : undefined,
    );
    if (result.ok) {
      setConfirmReloadOverwrite(false);
      setToast("🌷 已从 GitHub 重新加载");
      return;
    }

    if (isReloadOverwriteBlocked(result.errorCode)) {
      setConfirmReloadOverwrite(true);
      setToast(result.reason ?? "当前有未同步修改，请先同步或再次确认覆盖");
      return;
    }

    setToast(result.reason ?? "从 GitHub 重新加载失败");
  };

  const onSyncToGitHub = async () => {
    const password = syncPassword || readSavedSyncPassword();
    const result = await syncToGitHub(password);
    if (result.ok) {
      setToast("✨ 已同步到 GitHub");
      if (rememberSyncPassword) {
        saveSyncPassword(password);
        setHasSavedSyncPassword(true);
      } else {
        clearSavedSyncPassword();
        setHasSavedSyncPassword(false);
        setSyncPassword("");
      }
      return;
    }

    if (
      result.errorCode === "WRONG_PASSWORD" ||
      result.reason === "同步密码不正确"
    ) {
      clearSavedSyncPassword();
      setHasSavedSyncPassword(false);
      setRememberSyncPassword(false);
      setSyncPassword("");
      setToast("同步密码不正确");
      return;
    }

    setToast(result.reason ?? "同步到 GitHub 失败");
  };

  const onClearSavedPassword = () => {
    clearSavedSyncPassword();
    setHasSavedSyncPassword(false);
    setRememberSyncPassword(false);
    setSyncPassword("");
    setToast("已清除本设备保存的同步密码");
  };

  const innerContent = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] ui-text-primary">
            BACKUP
          </p>
          <h2 id={titleId} className="mt-1 text-lg font-bold ui-text-main">
            📤 数据管理
          </h2>
          <p className="mt-1 text-xs font-medium ui-text-muted">
            备份本地数据，或导出每周复盘
          </p>
        </div>
        {!isInline ? (
          <AppButton
            type="button"
            onClick={closeSheet}
            className="app-button--secondary shrink-0 px-3 py-1 text-xs font-semibold"
          >
            收起
          </AppButton>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2">
        <div className="app-card--panel app-card--item">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold ui-text-main">
              GitHub 同步状态
            </span>
            <span className="ui-badge ui-chip-plain">{syncStatus}</span>
          </div>
          <p className="mt-1 text-[10px] font-medium leading-relaxed ui-text-muted">
            {syncStatusDetail}
          </p>
          {syncErrorCode === "MISSING_PASSWORD" ? (
            <p className="mt-1 text-[10px] font-medium leading-relaxed ui-text-muted">
              勾选“记住本设备”并同步成功一次后，后续本地修改会自动同步。
            </p>
          ) : null}
        </div>
        <AppButton
          type="button"
          onClick={onReloadFromGitHub}
          disabled={syncBusy}
          className="app-button--secondary w-full py-3 text-sm font-semibold disabled:opacity-60"
        >
          {confirmReloadOverwrite ? "确认覆盖本地并重新加载" : "从 GitHub 重新加载"}
        </AppButton>
        <div className="app-card--panel app-card--item grid gap-2">
          {hasSavedSyncPassword ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold ui-text-main">
                已保存本设备同步密码
              </span>
              <AppButton
                type="button"
                onClick={onClearSavedPassword}
                className="app-button--secondary shrink-0 px-3 py-1.5 text-xs font-semibold"
              >
                清除已保存密码
              </AppButton>
            </div>
          ) : (
            <label className="grid gap-1 text-left">
              <span className="text-[11px] font-bold ui-text-main">
                同步密码
              </span>
              <AppInput
                type="password"
                value={syncPassword}
                onChange={(event) => setSyncPassword(event.target.value)}
                className="app-input w-full px-3 py-2 text-sm font-semibold outline-none"
                placeholder="第一次同步时输入"
              />
            </label>
          )}
          <label className="flex items-center gap-2 text-[11px] font-semibold ui-text-muted">
            <input
              type="checkbox"
              checked={rememberSyncPassword}
              onChange={(event) =>
                setRememberSyncPassword(event.target.checked)
              }
              className="h-4 w-4 accent-[var(--primary)]"
            />
            <span>记住本设备</span>
          </label>
          <AppButton
            type="button"
            onClick={onSyncToGitHub}
            disabled={syncBusy}
            className="app-button--primary w-full py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            同步到 GitHub
          </AppButton>
        </div>
        <AppButton
          type="button"
          onClick={onExportJson}
          className="app-button--primary w-full py-3 text-sm font-semibold text-white"
        >
          导出完整备份 JSON
        </AppButton>
        <AppButton
          type="button"
          onClick={onPickImportFile}
          className="app-button--secondary w-full py-3 text-sm font-semibold"
        >
          导入完整备份 JSON
        </AppButton>
        <AppButton
          type="button"
          onClick={onExportCsv}
          className="app-button--secondary w-full py-3 text-sm font-semibold"
        >
          导出每周复盘 CSV
        </AppButton>
      </div>

      {exportedFile ? (
        <div className="app-card--panel app-card--item mt-3">
          <p className="text-[11px] font-bold ui-text-main">文件已生成</p>
          <p className="mt-1 break-all text-[11px] font-medium leading-relaxed ui-text-muted">
            {exportedFile.name}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <a
              href={exportedFile.url}
              download={exportedFile.name}
              className="app-button--primary inline-flex items-center justify-center py-2.5 text-sm font-semibold text-white"
            >
              下载文件
            </a>
            <a
              href={exportedFile.url}
              target="_blank"
              rel="noreferrer"
              className="app-button--secondary inline-flex items-center justify-center py-2.5 text-sm font-semibold"
            >
              打开预览
            </a>
            <AppButton
              type="button"
              onClick={copyExportedFile}
              className="app-button--secondary py-2.5 text-sm font-semibold"
            >
              复制内容
            </AppButton>
          </div>
          <p className="mt-2 text-[10px] font-medium leading-relaxed ui-text-soft">
            如果右侧浏览器没有显示下载记录，请点这里的&ldquo;下载文件&rdquo;再保存一次。
          </p>
          <AppTextarea
            ref={exportTextRef}
            readOnly
            value={exportedFile.content}
            onFocus={(event) => event.currentTarget.select()}
            className="app-input mt-3 max-h-44 min-h-28 w-full resize-y px-3 py-2 text-[11px] font-mono leading-relaxed outline-none"
          />
          <AppButton
            type="button"
            onClick={selectExportedText}
            className="app-button--secondary mt-2 w-full py-2.5 text-sm font-semibold"
          >
            选中全部内容
          </AppButton>
        </div>
      ) : null}
    </>
  );

  return (
    <>
      {!isInline ? (
        <AppButton
          type="button"
          onClick={openSheet}
          className="app-button--nav inline-flex w-full whitespace-nowrap text-[12px] sm:text-sm"
        >
          <span aria-hidden>📤</span>
          <span>数据管理</span>
        </AppButton>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onImportFileChange}
      />

      {isInline ? (
        innerContent
      ) : open ? (
        <div className="fixed inset-0 z-[55] flex items-end justify-center p-3 sm:items-center sm:p-4">
          <AppDialogBackdrop
            aria-label="关闭数据管理"
            className={`app-dialog-backdrop absolute inset-0 transition-opacity duration-300 ${
              sheetEnter ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeSheet}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`app-dialog-shell data-management-sheet relative flex w-full max-w-md flex-col p-4 transition-all duration-300 ease-out ${
              sheetEnter
                ? "translate-y-0 opacity-100 sm:scale-100"
                : "translate-y-4 opacity-0 sm:scale-95"
            }`}
          >
            {innerContent}
          </div>
        </div>
      ) : null}

      {pendingImport ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <AppDialogBackdrop
            aria-label="取消导入"
            className="app-dialog-backdrop absolute inset-0"
            onClick={() => setPendingImport(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={confirmTitleId}
            className="app-dialog relative w-full max-w-sm overflow-hidden px-5 py-5 text-center"
          >
            <h3 id={confirmTitleId} className="text-lg font-bold ui-text-main">
              导入会覆盖当前本地数据，确认继续吗？
            </h3>
            <p className="mt-2 text-xs leading-relaxed ui-text-muted">
              {pendingImport.name}
            </p>
            <div className="mt-5 flex gap-2">
              <AppButton
                type="button"
                onClick={() => setPendingImport(null)}
                className="app-button--secondary flex-1 py-3 text-sm font-semibold"
              >
                取消
              </AppButton>
              <AppButton
                type="button"
                onClick={confirmImport}
                className="app-button--primary flex-1 py-3 text-sm font-semibold text-white"
              >
                确认导入
              </AppButton>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <AppToast
          role="status"
          className={`pointer-events-none fixed bottom-[max(5.5rem,env(safe-area-inset-bottom))] left-1/2 z-[80] w-[min(92vw,22rem)] -translate-x-1/2 rounded-2xl border px-4 py-3 text-center text-xs font-semibold leading-relaxed shadow-lg backdrop-blur-md ${
            toast.includes("失败") || toast.includes("不正确")
              ? "border-rose-100 bg-rose-50/95 text-rose-500 shadow-rose-100/40"
              : "border-rose-100/70 bg-white/85 text-stone-600 shadow-rose-100/40"
          }`}
        >
          {toast}
        </AppToast>
      ) : null}
    </>
  );
}
