"use client";

import React from "react";
import { X, Repeat, BookOpen, Heart, Wand2, Headphones, Info as InfoCircle } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PresetInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  presetName: string;
}

export default function PresetInfoModal({ 
  isOpen, 
  onClose, 
  presetName, 
}: PresetInfoModalProps) {
  const { t, fontClass, serifFontClass } = useLanguage();

  const getPresetInfo = (presetName: string) => {
    const presetInfoMap: { [key: string]: { title: string; description: string; features: string[] } } = {
      "mirror_realm": {
        title: t("presetInfo.mirrorRealm.title"),
        description: t("presetInfo.mirrorRealm.description"),
        features: [
          t("presetInfo.mirrorRealm.feature1"),
          t("presetInfo.mirrorRealm.feature2"),
          t("presetInfo.mirrorRealm.feature3"),
          t("presetInfo.mirrorRealm.feature4"),
        ],
      },
      "novel_king": {
        title: t("presetInfo.novelKing.title"),
        description: t("presetInfo.novelKing.description"),
        features: [
          t("presetInfo.novelKing.feature1"),
          t("presetInfo.novelKing.feature2"),
          t("presetInfo.novelKing.feature3"),
          t("presetInfo.novelKing.feature4"),
        ],
      },
      "professional_heart": {
        title: t("presetInfo.professionalHeart.title"),
        description: t("presetInfo.professionalHeart.description"),
        features: [
          t("presetInfo.professionalHeart.feature1"),
          t("presetInfo.professionalHeart.feature2"),
          t("presetInfo.professionalHeart.feature3"),
          t("presetInfo.professionalHeart.feature4"),
        ],
      },
      "magician": {
        title: t("presetInfo.magician.title"),
        description: t("presetInfo.magician.description"),
        features: [
          t("presetInfo.magician.feature1"),
          t("presetInfo.magician.feature2"),
          t("presetInfo.magician.feature3"),
          t("presetInfo.magician.feature4"),
        ],
      },
      "whisperer": {
        title: t("presetInfo.whisperer.title"),
        description: t("presetInfo.whisperer.description"),
        features: [
          t("presetInfo.whisperer.feature1"),
          t("presetInfo.whisperer.feature2"),
          t("presetInfo.whisperer.feature3"),
          t("presetInfo.whisperer.feature4"),
        ],
      },
    };

    return presetInfoMap[presetName] || {
      title: t("presetInfo.unknown.title"),
      description: t("presetInfo.unknown.description"),
      features: [],
    };
  };

  const presetInfo = getPresetInfo(presetName);

  const getPresetIcon = (presetName: string) => {
    const iconMap: { [key: string]: React.ReactNode } = {
      "mirror_realm": <Repeat size={24} />,
      "novel_king": <BookOpen size={24} />,
      "professional_heart": <Heart size={24} />,
      "magician": <Wand2 size={24} />,
      "whisperer": <Headphones size={24} />,
    };

    return iconMap[presetName] || <InfoCircle size={24} />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className=" bg-opacity-75 border border-border rounded-xl  p-4 sm:p-6 w-full max-w-lg backdrop-filter backdrop-blur-sm max-h-[85vh] overflow-hidden"
        hideCloseButton
      >
        <DialogTitle className="sr-only">{presetInfo.title}</DialogTitle>
        {/* ═══════════════════════════════════════════════════════════
            关闭按钮 - Close Button
            ═══════════════════════════════════════════════════════════ */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20"
        >
          <X size={18} />
        </Button>
        
        {/* ═══════════════════════════════════════════════════════════
            头部区域 - Header Section
            ═══════════════════════════════════════════════════════════ */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-3">
            <div className="w-12 h-12 flex items-center justify-center text-primary-bright bg-surface rounded-xl border border-border ">
              {getPresetIcon(presetName)}
            </div>
          </div>
          <h1 className={"text-xl sm:text-2xl font-bold text-primary-bright mb-2 "}>
            {presetInfo.title}
          </h1>
          <p className={`text-sm text-ink-soft ${fontClass}`}>
            {t("presetInfo.modalTitle")}
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            内容区域 - Content Section
            ═══════════════════════════════════════════════════════════ */}
        <div className="overflow-y-auto max-h-[50vh] space-y-4">
          {/* 描述信息 - Description */}
          <div className="p-4 bg-gradient-to-br from-overlay/60 via-deep/40 to-overlay/60 rounded-md border border-border/50">
            <h3 className={"text-sm font-medium text-cream mb-2 "}>
              {t("presetInfo.description")}
            </h3>
            <p className={`text-xs sm:text-sm text-primary-soft leading-relaxed ${fontClass}`}>
              {presetInfo.description}
            </p>
          </div>

          {/* 特性列表 - Features List */}
          <div className="p-4 bg-gradient-to-br from-overlay/60 via-deep/40 to-overlay/60 rounded-md border border-border/50">
            <h3 className={"text-sm font-medium text-cream mb-3 "}>
              {t("presetInfo.features")}
            </h3>
            <ul className="space-y-2">
              {presetInfo.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary-bright mt-2 mr-3 flex-shrink-0"></div>
                  <span className={`text-xs sm:text-sm text-primary-soft ${fontClass}`}>
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* 使用提示 - Usage Tip */}
          <div className="p-3 bg-gradient-to-r from-primary-900/20 to-orange-900/20 border border-primary-500/30 rounded-md">
            <div className="flex items-start">
              <div className="w-4 h-4 flex items-center justify-center text-primary-400 mr-2 mt-0.5 flex-shrink-0">
                <InfoCircle size={14} />
              </div>
              <p className={`text-xs text-primary-300 leading-relaxed ${fontClass}`}>
                {t("presetInfo.tip")}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
