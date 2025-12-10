"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { Button } from "@/components/ui/button";

interface PWAInstallButtonProps {
  isOpen: boolean;
  animationComplete: boolean;
  fontClass: string;
  onOpenDownloadModal: () => void;
}

export default function PWAInstallButton({ isOpen, animationComplete, fontClass, onOpenDownloadModal }: PWAInstallButtonProps) {
  const { t } = useLanguage();

  return (
    <Button
      variant="ghost"
      onClick={onOpenDownloadModal}
      className={`w-full ${!isOpen ? "p-2 justify-center" : "py-1.5 px-2 justify-start"}`}
    >
      <Download size={isOpen ? 14 : 16} />
      {isOpen && (
        <span className={`ml-2 text-xs ${fontClass}`}>
          {t("sidebar.downloadApp")}
        </span>
      )}
    </Button>
  );
} 
