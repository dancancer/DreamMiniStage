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
          <div className="relative z-10 w-full max-w-md mx-4 bg-gradient-to-br from-canvas via-surface to-canvas rounded-2xl  border border-muted-surface/50 overflow-hidden backdrop-filter backdrop-blur-sm animate-in fade-in zoom-in-95 slide-in-from-bottom-5 duration-300">
            {/* Animated background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-purple-500/5 opacity-60" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f59e0b' fill-opacity='0.03'%3E%3Cpath d='M30 30l30-30v60L30 30z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20" />
            
            {/* Header */}
            <div className="relative p-6 pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className={`text-xl font-bold text-white mb-2 flex items-center ${titleFontClass}`}>
                    <Download className="w-5 h-5 mr-2 text-primary-bright" />
                    {t("appDownload.title")}
                  </h3>
                  <p className={`text-gray-300 text-sm ${langFontClass}`}>
                    {t("appDownload.subtitle")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-gray-400 hover:text-white p-1 hover:bg-white/10"
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
                    className="w-full flex items-center p-4 h-auto bg-gradient-to-r from-gray-800/80 to-gray-700/80 hover:from-gray-700/80 hover:to-gray-600/80 rounded-xl border border-gray-600/50 hover:border-gray-500/70 backdrop-blur-sm group hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className={`${option.color} mr-4 group-hover:scale-110 transition-transform duration-200`}>
                      {option.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <div className={`text-white font-semibold ${langFontClass}`}>
                        {t(`appDownload.platforms.${option.platform}`)}
                      </div>
                      <div className={`text-gray-400 text-sm ${langFontClass}`}>
                        {t(`appDownload.descriptions.${option.platform}`)}
                      </div>
                    </div>
                    <div className="text-gray-500 group-hover:text-gray-300 transition-colors">
                      <Download size={16} />
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            {/* Tip Section */}
            <div className="relative px-6 pb-6">
              <div className="p-4 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl backdrop-blur-sm">
                <p className={`text-blue-300 text-xs leading-relaxed ${langFontClass}`}>
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
