"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useHomeResources } from "./HomeResourcesProvider";

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

export function DataManagement() {
  const { exportBackupJson, exportWeeklyReviewCsv, importBackupJson } =
    useHomeResources();
  const [open, setOpen] = useState(false);
  const [sheetEnter, setSheetEnter] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [exportedFile, setExportedFile] = useState<ExportedFile | null>(null);
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ui-nav-button inline-flex w-full whitespace-nowrap text-[12px] sm:text-sm"
      >
        <span aria-hidden>📤</span>
        <span>数据管理</span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onImportFileChange}
      />

      {open ? (
        <div className="fixed inset-0 z-[55] flex items-end justify-center p-3 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="关闭数据管理"
            className={`ui-modal-backdrop absolute inset-0 transition-opacity duration-300 ${
              sheetEnter ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeSheet}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`ui-sheet relative flex w-full max-w-md flex-col overflow-hidden p-4 transition-all duration-300 ease-out ${
              sheetEnter
                ? "translate-y-0 opacity-100 sm:scale-100"
                : "translate-y-4 opacity-0 sm:scale-95"
            }`}
          >
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
              <button
                type="button"
                onClick={closeSheet}
                className="ui-button-secondary shrink-0 px-3 py-1 text-xs font-semibold"
              >
                收起
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={onExportJson}
                className="ui-button-primary w-full py-3 text-sm font-semibold text-white"
              >
                导出完整备份 JSON
              </button>
              <button
                type="button"
                onClick={onPickImportFile}
                className="ui-button-secondary w-full py-3 text-sm font-semibold"
              >
                导入完整备份 JSON
              </button>
              <button
                type="button"
                onClick={onExportCsv}
                className="ui-button-secondary w-full py-3 text-sm font-semibold"
              >
                导出每周复盘 CSV
              </button>
            </div>

            {exportedFile ? (
              <div className="ui-soft-panel ui-card-item mt-3">
                <p className="text-[11px] font-bold ui-text-main">文件已生成</p>
                <p className="mt-1 break-all text-[11px] font-medium leading-relaxed ui-text-muted">
                  {exportedFile.name}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <a
                    href={exportedFile.url}
                    download={exportedFile.name}
                    className="ui-button-primary inline-flex items-center justify-center py-2.5 text-sm font-semibold text-white"
                  >
                    下载文件
                  </a>
                  <a
                    href={exportedFile.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ui-button-secondary inline-flex items-center justify-center py-2.5 text-sm font-semibold"
                  >
                    打开预览
                  </a>
                  <button
                    type="button"
                    onClick={copyExportedFile}
                    className="ui-button-secondary py-2.5 text-sm font-semibold"
                  >
                    复制内容
                  </button>
                </div>
                <p className="mt-2 text-[10px] font-medium leading-relaxed ui-text-soft">
                  如果右侧浏览器没有显示下载记录，请点这里的“下载文件”再保存一次。
                </p>
                <textarea
                  ref={exportTextRef}
                  readOnly
                  value={exportedFile.content}
                  onFocus={(event) => event.currentTarget.select()}
                  className="ui-input mt-3 max-h-44 min-h-28 w-full resize-y px-3 py-2 text-[11px] font-mono leading-relaxed outline-none"
                />
                <button
                  type="button"
                  onClick={selectExportedText}
                  className="ui-button-secondary mt-2 w-full py-2.5 text-sm font-semibold"
                >
                  选中全部内容
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {pendingImport ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="取消导入"
            className="ui-modal-backdrop absolute inset-0"
            onClick={() => setPendingImport(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={confirmTitleId}
            className="ui-dialog relative w-full max-w-sm overflow-hidden px-5 py-5 text-center"
          >
            <h3 id={confirmTitleId} className="text-lg font-bold ui-text-main">
              导入会覆盖当前本地数据，确认继续吗？
            </h3>
            <p className="mt-2 text-xs leading-relaxed ui-text-muted">
              {pendingImport.name}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                className="ui-button-secondary flex-1 py-3 text-sm font-semibold"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmImport}
                className="ui-button-primary flex-1 py-3 text-sm font-semibold text-white"
              >
                确认导入
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          className="ui-dialog pointer-events-none fixed bottom-[max(5.5rem,env(safe-area-inset-bottom))] left-1/2 z-[80] w-[min(92vw,22rem)] -translate-x-1/2 px-4 py-3 text-center text-xs font-semibold leading-relaxed ui-text-main"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
