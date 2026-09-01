"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Switch, Title } from "animal-island-ui";
import { isReloadOverwriteBlocked } from "@/lib/home/sync-state-service";
import { useHomeResources } from "./HomeResourcesProvider";
import {
  AppButton,
  AppButtonLink,
  AppCard,
  AppGameIcon,
  AppInput,
  AppModal,
  AppTextarea,
  AppToast,
} from "../ui";

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

type CloudSessionResponse = {
  ok?: boolean;
  error?: string;
  errorCode?: string;
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
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [exportedFile, setExportedFile] = useState<ExportedFile | null>(null);
  const [syncPassword, setSyncPassword] = useState("");
  const [rememberSyncPassword, setRememberSyncPassword] = useState(false);
  const [hasSavedSyncPassword, setHasSavedSyncPassword] = useState(false);
  const [confirmReloadOverwrite, setConfirmReloadOverwrite] = useState(false);
  const [connectingCloud, setConnectingCloud] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const exportTextRef = useRef<HTMLTextAreaElement | null>(null);
  const confirmTitleId = useId();

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

  const syncBusy =
    connectingCloud || syncStatus === "正在加载" || syncStatus === "正在同步";
  const isFirstCloudConnect = !lastSyncedAt;
  const syncStatusDetail =
    syncErrorReason ??
    (lastSyncedAt
      ? `上次同步：${new Date(lastSyncedAt).toLocaleString()}`
      : "新设备首次使用时，请输入同步密码并连接云端");

  const handleWrongPassword = () => {
    clearSavedSyncPassword();
    setHasSavedSyncPassword(false);
    setRememberSyncPassword(false);
    setSyncPassword("");
    setToast("同步密码不正确");
  };

  const connectCloudSession = async (password: string) => {
    const response = await fetch("/api/cloud-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const result = (await response.json().catch(() => null)) as
      | CloudSessionResponse
      | null;
    if (!response.ok) {
      return {
        ok: false as const,
        reason: result?.error ?? "连接云端失败",
        errorCode: result?.errorCode,
      };
    }
    return { ok: true as const };
  };

  const onReloadFromCloud = async () => {
    const password = (syncPassword || readSavedSyncPassword()).trim();

    if (isFirstCloudConnect && !password) {
      setToast("请输入同步密码后连接云端");
      return;
    }

    setConnectingCloud(true);
    try {
      if (password) {
        const sessionResult = await connectCloudSession(password);
        if (!sessionResult.ok) {
          if (sessionResult.errorCode === "WRONG_PASSWORD") {
            handleWrongPassword();
            return;
          }
          setToast(sessionResult.reason);
          return;
        }
      }

      const result = await reloadFromGitHub(
        confirmReloadOverwrite
          ? { force: true, allowDirtyOverwrite: true }
          : undefined,
      );
      if (result.ok) {
        setConfirmReloadOverwrite(false);
        if (password && rememberSyncPassword) {
          saveSyncPassword(password);
          setHasSavedSyncPassword(true);
        } else if (password && !rememberSyncPassword) {
          clearSavedSyncPassword();
          setHasSavedSyncPassword(false);
          setSyncPassword("");
        }
        setToast(
          isFirstCloudConnect
            ? "🌷 已连接云端并下载数据"
            : "🌷 已从云端重新加载",
        );
        return;
      }

      if (isReloadOverwriteBlocked(result.errorCode)) {
        setConfirmReloadOverwrite(true);
        setToast(result.reason ?? "当前有未同步修改，请先同步或再次确认覆盖");
        return;
      }

      setToast(result.reason ?? "从云端重新加载失败");
    } finally {
      setConnectingCloud(false);
    }
  };

  const onSyncToGitHub = async () => {
    const password = syncPassword || readSavedSyncPassword();
    const result = await syncToGitHub(password);
    if (result.ok) {
      setToast("✨ 已同步到云端");
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
      handleWrongPassword();
      return;
    }

    if (result.errorCode === "CLOUD_SESSION_REQUIRED") {
      setToast("首次连接请先点击“连接云端并下载数据”");
      return;
    }

    setToast(result.reason ?? "同步到云端失败");
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
      {!isInline ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] ui-text-primary">
              BACKUP
            </p>
            <Title size="small" color="app-yellow" className="mt-1">
              <span aria-hidden>
                <AppGameIcon name="data" size={20} />
              </span>{" "}
              数据管理
            </Title>
            <p className="mt-1 text-xs font-medium ui-text-muted">
              备份、同步、复盘
            </p>
          </div>
          <AppButton
            type="button"
            onClick={closeSheet}
            className="is-secondary shrink-0 px-3 py-1 text-xs font-semibold"
          >
            收起
          </AppButton>
        </div>
      ) : null}

      <div className={isInline ? "grid gap-2" : "mt-4 grid gap-2"}>
        <AppCard variant="panel">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold ui-text-main">
              云端同步状态
            </span>
            <AppButton type="button" size="small" disabled>
              {syncStatus}
            </AppButton>
          </div>
          <p className="mt-1 text-[10px] font-medium leading-relaxed ui-text-muted">
            {syncStatusDetail}
          </p>
          {syncErrorCode === "MISSING_PASSWORD" ? (
            <p className="mt-1 text-[10px] font-medium leading-relaxed ui-text-muted">
              保存密码后可自动同步。
            </p>
          ) : null}
        </AppCard>

        <AppCard variant="panel" className="grid gap-2">
          {hasSavedSyncPassword ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold ui-text-main">
                已保存本设备同步密码
              </span>
              <AppButton
                type="button"
                onClick={onClearSavedPassword}
                className="is-secondary shrink-0 px-3 py-1.5 text-xs font-semibold"
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
                placeholder={
                  isFirstCloudConnect ? "输入密码连接云端" : "同步或重新连接时输入"
                }
              />
            </label>
          )}
          <label className="flex items-center gap-2 text-[11px] font-semibold ui-text-muted">
            <Switch
              size="small"
              checked={rememberSyncPassword}
              onChange={setRememberSyncPassword}
            />
            <span>记住本设备</span>
          </label>
          <AppButton
            type="button"
            onClick={onReloadFromCloud}
            disabled={syncBusy}
            className="is-primary w-full py-3 text-sm font-semibold disabled:opacity-60"
          >
            {confirmReloadOverwrite
              ? "确认覆盖本地并重新加载"
              : isFirstCloudConnect
                ? "连接云端并下载数据"
                : "从云端重新加载"}
          </AppButton>
          <AppButton
            type="button"
            onClick={onSyncToGitHub}
            disabled={syncBusy}
            className="is-secondary w-full py-3 text-sm font-semibold disabled:opacity-60"
          >
            同步到云端
          </AppButton>
          {isFirstCloudConnect ? (
            <p className="text-[10px] font-medium leading-relaxed ui-text-muted">
              首次连接只会下载云端数据，不会用本机空数据覆盖云端。
            </p>
          ) : null}
        </AppCard>

        <AppButton
          type="button"
          onClick={onExportJson}
          className="is-primary w-full py-3 text-sm font-semibold"
        >
          导出完整备份 JSON
        </AppButton>
        <AppButton
          type="button"
          onClick={onPickImportFile}
          className="is-secondary w-full py-3 text-sm font-semibold"
        >
          导入完整备份 JSON
        </AppButton>
        <AppButton
          type="button"
          onClick={onExportCsv}
          className="is-secondary w-full py-3 text-sm font-semibold"
        >
          导出每周复盘 CSV
        </AppButton>
      </div>

      {exportedFile ? (
        <AppCard variant="panel" className="mt-3">
          <p className="text-[11px] font-bold ui-text-main">文件已生成</p>
          <p className="mt-1 break-all text-[11px] font-medium leading-relaxed ui-text-muted">
            {exportedFile.name}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <AppButtonLink
              variant="primary"
              href={exportedFile.url}
              download={exportedFile.name}
              className="inline-flex items-center justify-center py-2.5 text-sm font-semibold"
            >
              下载文件
            </AppButtonLink>
            <AppButtonLink
              href={exportedFile.url}
              target="_blank"
              rel="noreferrer"
              className="is-secondary inline-flex items-center justify-center py-2.5 text-sm font-semibold"
            >
              打开预览
            </AppButtonLink>
            <AppButton
              type="button"
              onClick={copyExportedFile}
              className="is-secondary py-2.5 text-sm font-semibold"
            >
              复制内容
            </AppButton>
          </div>
          <p className="mt-2 text-[10px] font-medium leading-relaxed ui-text-soft">
            下载失败时可复制内容。
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
            className="is-secondary mt-2 w-full py-2.5 text-sm font-semibold"
          >
            选中全部内容
          </AppButton>
        </AppCard>
      ) : null}
    </>
  );

  return (
    <>
      {!isInline ? (
        <AppButton
          type="button"
          onClick={openSheet}
          className="is-nav inline-flex w-full whitespace-nowrap text-[12px] sm:text-sm"
        >
          <AppGameIcon name="data" size={16} />
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
      ) : (
        <AppModal
          open={open}
          onClose={closeSheet}
          maskClosable
          width="min(92vw, 32rem)"
          footer={null}
        >
          <div className="app-modal-scroll-body data-management-sheet">
            {innerContent}
          </div>
        </AppModal>
      )}

      <AppModal
        open={Boolean(pendingImport)}
        onClose={() => setPendingImport(null)}
        maskClosable
        width="min(92vw, 24rem)"
        title={
          <span id={confirmTitleId}>导入会覆盖当前本地数据，确认继续吗？</span>
        }
        footer={
          <div className="app-dialog-footer">
            <AppButton
              type="button"
              onClick={() => setPendingImport(null)}
              className="is-secondary flex-1 py-3 text-sm font-semibold"
            >
              取消
            </AppButton>
            <AppButton
              type="button"
              onClick={confirmImport}
              className="is-primary flex-1 py-3 text-sm font-semibold"
            >
              确认导入
            </AppButton>
          </div>
        }
      >
        {pendingImport ? (
          <p className="mt-2 text-xs leading-relaxed ui-text-muted">
            {pendingImport.name}
          </p>
        ) : null}
      </AppModal>

      {toast ? (
        <AppToast
          role="status"
          className={`pointer-events-none fixed bottom-[max(5.5rem,env(safe-area-inset-bottom))] left-1/2 z-[80] w-[min(92vw,22rem)] -translate-x-1/2 px-4 py-3 text-center text-xs font-semibold leading-relaxed ${
            toast.includes("失败") || toast.includes("不正确") ? "" : ""
          }`}
        >
          {toast}
        </AppToast>
      ) : null}
    </>
  );
}
