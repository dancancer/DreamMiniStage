"use client";

import { useState, useRef, useEffect } from "react";
import { Settings, Languages, Sun, LayoutGrid, LayoutDashboard, Volume2, VolumeX, Download, Upload } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { useSoundContext } from "@/contexts/SoundContext";
import { useTheme } from "@/contexts/ThemeContext";
import { exportDataToFile, importDataFromFile, generateExportFilename, downloadFile } from "@/function/data/export-import";
import { backupToGoogle, getFolderList, getGoogleCodeByUrl, getGoogleLoginUrl, getBackUpFile } from "@/function/data/google-control";
import { getString } from "@/lib/storage/client-storage";
import PluginManagerModal from "@/components/PluginManagerModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface SettingsDropdownProps {
  toggleModelSidebar: () => void;
}

export default function SettingsDropdown({ toggleModelSidebar }: SettingsDropdownProps) {
  const [isPluginManagerOpen, setIsPluginManagerOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { soundEnabled, toggleSound } = useSoundContext();
  const { theme, toggleTheme } = useTheme();

  // Google Auth Effect
  const useFirst = useRef(false);
  useEffect(() => {
    if(useFirst.current) return;
    useFirst.current = true;
    getGoogleCodeByUrl(window.location);
  }, []);

  const toggleLanguage = () => {
    const newLanguage = language === "zh" ? "en" : "zh";
    setLanguage(newLanguage);
    document.documentElement.lang = newLanguage;
  };

  const handleExportData = async () => {
    try {
      const blob = await exportDataToFile();
      const filename = generateExportFilename();
      downloadFile(blob, filename);
    } catch (error) {
      console.error("Export failed:", error);
      alert(t("common.exportFailed"));
    }
  };

  const handleImportData = async () => {
    try {
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
    } catch (error) {
      console.error("Import failed:", error);
      alert(t("common.importFailed"));
    }
  };

  async function handleImportDataFromGoogle() {
    const token = getString("google_drive_token");
    if(token) {
      const res = await getFolderList();
      if(res?.id) {
        const file = await getBackUpFile(res.id);
        if(file) {
          await importDataFromFile(file);
          alert("导入成功！");
          window.location.reload();
        }
      }
    } else {
      const url = getGoogleLoginUrl();
      window.location.href = url;
    }
  }

  async function handleExportDataToGoogle() {
    const token = getString("google_drive_token");
    if(token) {
      const blob = await exportDataToFile();
      const filename = generateExportFilename();
      const res = await getFolderList();
      if(res?.id) {
        await backupToGoogle({
          blob,
          filename,
          folderId: res.id,
        });
        // todo
        alert("上传成功");
      } 
    } else {
      const url = getGoogleLoginUrl();
      window.location.href = url;
    }
  }

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            data-tour="settings-button"
            aria-label={t("common.settings")}
          >
            <Settings size={16} />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={toggleLanguage}>
            <Languages size={16} className="mr-2" />
            {language === "zh" ? t("common.switchToEnglish") : t("common.switchToChinese")}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={toggleTheme}>
            <Sun size={16} className="mr-2" />
            {theme === "dark" ? (t("common.switchToLight") ?? "切换至浅色") : (t("common.switchToDark") ?? "切换至深色")}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={toggleModelSidebar}>
            <LayoutGrid size={16} className="mr-2" />
            {t("modelSettings.title")}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setIsPluginManagerOpen(true)}>
            <LayoutDashboard size={16} className="mr-2" />
            {t("plugins.management")}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={toggleSound}>
            {soundEnabled ? <Volume2 size={16} className="mr-2" /> : <VolumeX size={16} className="mr-2" />}
            {soundEnabled ? t("common.soundOff") : t("common.soundOn")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("common.exportData")}</DropdownMenuLabel>
          
          <DropdownMenuItem onClick={handleExportData}>
            <Download size={16} className="mr-2" />
            {t("common.exportData")}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleImportData}>
            <Upload size={16} className="mr-2" />
            {t("common.importData")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Google Drive</DropdownMenuLabel>

          <DropdownMenuItem onClick={handleExportDataToGoogle}>
            <Download size={16} className="mr-2" />
            {t("common.exportDataToGoogle")}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleImportDataFromGoogle}>
            <Upload size={16} className="mr-2" />
            {t("common.importDataFromGoogle")}
          </DropdownMenuItem>

        </DropdownMenuContent>
      </DropdownMenu>
  
      <PluginManagerModal
        isOpen={isPluginManagerOpen}
        onClose={() => setIsPluginManagerOpen(false)}
      />
    </div>
  );
}
