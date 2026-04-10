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
      color: "text-foreground/80",
    },
    {
      platform: "android",
      icon: <Smartphone size={20} />,
      url: "#", // Replace with actual Android download link
      color: "text-success",
    },
    {
      platform: "windows",
      icon: <Monitor size={20} />,
      url: "#", // Replace with actual Windows download link
      color: "text-sky",
    },
    {
      platform: "macos",
      icon: <Apple size={20} />,
      url: "#", // Replace with actual macOS download link
      color: "text-foreground/80",
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
          <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
          
          {/* Modal */}
          <div className="relative z-10 mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card backdrop-blur-sm animate-in fade-in zoom-in-95 slide-in-from-bottom-5 duration-300">
            {/* Animated background */}
            <div className="absolute inset-0 bg-primary/5 opacity-60" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--color-primary)_12%,transparent),transparent_58%)] opacity-60" />
            
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
                  className="p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  aria-label={t("common.close")}
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
                    className="group h-auto w-full rounded-xl border border-border/60 bg-muted/60 p-4 backdrop-blur-sm hover:border-border hover:bg-muted active:scale-[0.98]"
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
              <div className="rounded-xl border border-border bg-accent/20 p-4 backdrop-blur-sm">
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
