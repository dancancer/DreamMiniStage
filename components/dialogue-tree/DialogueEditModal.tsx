/**
 * @input  @/hooks, @/components
 * @output DialogueEditModal
 * @pos    对话树可视化组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       DialogueEditModal                                   ║
 * ║  节点内容编辑弹窗：展示摘要 + 文本编辑 + 保存/取消                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { MessageSquare } from "lucide-react";
import { DialogueNode } from "@/hooks/useDialogueTreeData";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DialogueEditModalProps {
  node: DialogueNode;
  isSaving: boolean;
  editContent: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  fontClass: string;
  t: (key: string) => string;
}

export function DialogueEditModal({
  node,
  isSaving,
  editContent,
  onChange,
  onClose,
  onSave,
  fontClass,
  t,
}: DialogueEditModalProps) {
  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl border-border bg-card/95">
        <DialogHeader className="space-y-3">
          <DialogTitle>{t("dialogue.editNode")}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t("dialogue.memorySummary")}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/30 p-3">
          <ol className={`ml-2 list-decimal list-inside text-sm text-foreground ${fontClass}`}>
            {node.data.label.split(/——>|-->|->|→/).map((step, index) => (
              <li key={index} className="mb-1">
                {step.trim()}
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-2">
          <label htmlFor="dialogue-node-response" className="block text-sm font-medium text-foreground">
            <span className="flex items-center">
              <MessageSquare className="mr-1 h-3.5 w-3.5" />
              {t("dialogue.response")}
            </span>
          </label>
          <textarea
            id="dialogue-node-response"
            value={editContent}
            onChange={(e) => onChange(e.target.value)}
            className={`h-64 w-full rounded-md border border-border bg-background px-3 py-3 text-sm leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background ${fontClass}`}
            placeholder={t("dialogue.responsePlaceholder")}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label={t("common.cancel")}
            disabled={isSaving}
          >
            {t("common.cancel")}
          </Button>
          {isSaving ? (
            <div className="relative flex h-11 w-11 items-center justify-center sm:h-10 sm:w-10">
              <div className="absolute inset-0 rounded-full border-2 border-t-primary-bright border-r-primary-soft border-b-ink-soft border-l-transparent animate-spin"></div>
              <div className="absolute inset-1 rounded-full border-2 border-t-ink-soft border-r-primary-bright border-b-primary-soft border-l-transparent animate-spin-slow"></div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={onSave}
              className="text-primary hover:text-primary"
              aria-label={t("common.save")}
            >
              {t("common.save")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
