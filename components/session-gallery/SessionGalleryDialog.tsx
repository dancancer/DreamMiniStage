/**
 * @input  components/ui/dialog
 * @output SessionGalleryDialog
 * @pos    /session 画廊弹窗
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        Session Gallery Dialog                            ║
 * ║                                                                           ║
 * ║  最小产品面：展示当前 /session 画廊条目，给 slash 宿主一个可见落点。          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SessionGalleryItem } from "@/app/session/session-gallery";

interface Props {
  open: boolean;
  items: SessionGalleryItem[];
  onClose: () => void;
  target?: {
    character?: string;
    group?: string;
  };
}

function buildGalleryTitle(target?: Props["target"]): string {
  if (target?.character?.trim()) {
    return `${target.character} Gallery`;
  }
  if (target?.group?.trim()) {
    return `${target.group} Gallery`;
  }
  return "Session Gallery";
}

export default function SessionGalleryDialog({ open, items, onClose, target }: Props) {
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      return;
    }

    for (const item of items) {
      if (item.ephemeral) {
        URL.revokeObjectURL(item.src);
      }
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{buildGalleryTitle(target)}</DialogTitle>
          <DialogDescription>
            Review the current session gallery items resolved by the slash host.
          </DialogDescription>
        </DialogHeader>
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            No gallery items available.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.src} className="overflow-hidden rounded-lg border border-border bg-muted/30">
                <Image
                  src={item.src}
                  alt={item.src}
                  width={640}
                  height={384}
                  unoptimized={true}
                  className="h-48 w-full object-cover"
                />
                <div className="truncate border-t border-border px-3 py-2 text-xs text-muted-foreground">
                  {item.src}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
