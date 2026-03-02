/**
 * @input  @/app, @/components
 * @output DownloadModal
 * @pos    应用下载模态框
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

"use client";

import { Download, X, Monitor, Smartphone, Apple } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { Button } from "@/components/ui/button";

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DownloadModal({ isOpen, onClose }: DownloadModalProps) {
  const { t, fontClass: langFontClass, titleFontClass } = useLanguage();

  const downloadOptions = [
    {
      platform: "ios",
      icon: <Apple size={20} />,
      url: "#", // Replace with actual iOS download link
      color: "text-gray-300",
    },
    {
      platform: "android",
      icon: <Smartphone size={20} />,
      url: "#", // Replace with actual Android download link
      color: "text-green-400",
    },
    {
      platform: "windows",
      icon: <Monitor size={20} />,
      url: "#", // Replace with actual Windows download link
      color: "text-blue-400",
    },
    {
      platform: "macos",
      icon: <Apple size={20} />,
      url: "#", // Replace with actual macOS download link
      color: "text-gray-300",
    },
  ];

  const handlePlatformDownload = (url: string, platform: string) => {
    if (url === "#") {
      const platformName = t(`appDownload.platforms.${platform}`);
      alert(`${platformName} ${t("appDownload.comingSoon")}`);
      return;
    }
    // Open download link or trigger download
    window.open(url, "_blank");
    onClose();
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
          
          {/* Modal */}
          <div className="relative z-10 w-full max-w-md mx-4 bg-card rounded-2xl border border-muted-surface/50 overflow-hidden backdrop-filter backdrop-blur-sm animate-in fade-in zoom-in-95 slide-in-from-bottom-5 duration-300">
            {/* Animated background */}
            <div className="absolute inset-0 bg-primary/5 opacity-60" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f59e0b' fill-opacity='0.03'%3E%3Cpath d='M30 30l30-30v60L30 30z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20" />
            
            {/* Header */}
            <div className="relative p-6 pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className={`text-xl font-bold text-foreground mb-2 flex items-center ${titleFontClass}`}>
                    <Download className="w-5 h-5 mr-2 text-primary-bright" />
                    {t("appDownload.title")}
                  </h3>
                  <p className={`text-muted-foreground text-sm ${langFontClass}`}>
                    {t("appDownload.subtitle")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground p-1 hover:bg-muted/40"
                >
                  <X size={20} />
                </Button>
              </div>
            </div>

            {/* Platform Options */}
            <div className="relative px-6 pb-4">
              <div className="space-y-3">
                {downloadOptions.map((option) => (
                  <Button
                    key={option.platform}
                    variant="outline"
                    onClick={() => handlePlatformDownload(option.url, option.platform)}
                    className="w-full flex items-center p-4 h-auto bg-muted/60 hover:bg-muted rounded-xl border border-border/60 hover:border-border backdrop-blur-sm group active:scale-[0.98]"
                  >
                    <div className={`${option.color} mr-4`}>
                      {option.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <div className={`text-foreground font-semibold ${langFontClass}`}>
                        {t(`appDownload.platforms.${option.platform}`)}
                      </div>
                      <div className={`text-muted-foreground text-sm ${langFontClass}`}>
                        {t(`appDownload.descriptions.${option.platform}`)}
                      </div>
                    </div>
                    <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                      <Download size={16} />
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            {/* Tip Section */}
            <div className="relative px-6 pb-6">
              <div className="p-4 bg-accent/30 border border-border rounded-xl backdrop-blur-sm">
                <p className={`text-foreground text-xs leading-relaxed ${langFontClass}`}>
                  {t("appDownload.tip")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 
