/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                       Import Modal Footer                                 ║
 * ║                                                                          ║
 * ║  通用导入弹窗底部按钮区                                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface ImportModalFooterProps {
  activeTab: "file" | "global";
  isImporting: boolean;
  canImport: boolean;
  cancelLabel: string;
  importingLabel: string;
  importLabel: string;
  serifFontClass: string;
  onClose: () => void;
  onImport: () => void;
}

export function ImportModalFooter({
  activeTab,
  isImporting,
  canImport,
  cancelLabel,
  importingLabel,
  importLabel,
  serifFontClass,
  onClose,
  onImport,
}: ImportModalFooterProps) {
  return (
    <div className="relative p-3 border-t border-border/40 bg-gradient-to-r from-muted-surface/80 via-deep/60 to-muted-surface/80 backdrop-blur-sm flex justify-end space-x-2">
      <Button variant="ghost" size="sm" onClick={onClose}>
        {cancelLabel}
      </Button>
      {activeTab === "global" && (
        <Button size="sm" onClick={onImport} disabled={isImporting || !canImport}>
          {isImporting ? importingLabel : importLabel}
        </Button>
      )}
    </div>
  );
}
