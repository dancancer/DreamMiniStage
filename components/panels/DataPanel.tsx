/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                             DataPanel 数据面板                      ║
 * ║  数据导入导出与 Google Drive 同步入口。                             ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { Download, Upload, Cloud } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { exportDataToFile, importDataFromFile, generateExportFilename, downloadFile } from "@/function/data/export-import";
import { Button } from "@/components/ui/button";
import { backupToGoogle, getFolderList, getGoogleCodeByUrl, getGoogleLoginUrl, getBackUpFile } from "@/function/data/google-control";
import { getString } from "@/lib/storage/client-storage";

export function DataPanel() {
  const { t } = useLanguage();

  const handleExportData = async () => {
    const blob = await exportDataToFile();
    const filename = generateExportFilename();
    downloadFile(blob, filename);
  };

  const handleImportData = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await importDataFromFile(file);
        window.location.reload();
      }
    };
    input.click();
  };

  const ensureGoogleCode = () => {
    getGoogleCodeByUrl(window.location);
  };

  const handleImportDataFromGoogle = async () => {
    ensureGoogleCode();
    const token = getString("google_drive_token");
    if (!token) {
      window.location.href = getGoogleLoginUrl();
      return;
    }
    const folder = await getFolderList();
    if (!folder?.id) return;
    const file = await getBackUpFile(folder.id);
    if (file) {
      await importDataFromFile(file);
      alert("导入成功！");
      window.location.reload();
    }
  };

  const handleExportDataToGoogle = async () => {
    ensureGoogleCode();
    const token = getString("google_drive_token");
    if (!token) {
      window.location.href = getGoogleLoginUrl();
      return;
    }
    const blob = await exportDataToFile();
    const filename = generateExportFilename();
    const folder = await getFolderList();
    if (folder?.id) {
      await backupToGoogle({ blob, filename, folderId: folder.id });
      alert("上传成功");
    }
  };

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <div>
        <div className="text-base font-semibold text-foreground">数据管理</div>
        <div className="text-sm text-muted-foreground">导入导出本地数据，或同步到 Google Drive。</div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <Button
          variant="outline"
          className="flex items-center justify-between h-auto bg-muted/40 px-3 py-2 text-sm hover:bg-muted"
          onClick={handleExportData}
        >
          <span className="flex items-center gap-2">
            <Download size={16} />
            {t("common.exportData") ?? "导出数据"}
          </span>
          <span className="text-xs text-muted-foreground">JSON</span>
        </Button>

        <Button
          variant="outline"
          className="flex items-center justify-between h-auto bg-muted/40 px-3 py-2 text-sm hover:bg-muted"
          onClick={handleImportData}
        >
          <span className="flex items-center gap-2">
            <Upload size={16} />
            {t("common.importData") ?? "导入数据"}
          </span>
          <span className="text-xs text-muted-foreground">JSON</span>
        </Button>

        <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Cloud size={16} />
            Google Drive
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="outline"
              className="flex items-center justify-between h-auto bg-background px-3 py-2 text-sm hover:bg-muted"
              onClick={handleExportDataToGoogle}
            >
              <span className="flex items-center gap-2">
                <Download size={16} />
                {t("common.exportDataToGoogle") ?? "导出到 Google Drive"}
              </span>
            </Button>

            <Button
              variant="outline"
              className="flex items-center justify-between h-auto bg-background px-3 py-2 text-sm hover:bg-muted"
              onClick={handleImportDataFromGoogle}
            >
              <span className="flex items-center gap-2">
                <Upload size={16} />
                {t("common.importDataFromGoogle") ?? "从 Google Drive 导入"}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
