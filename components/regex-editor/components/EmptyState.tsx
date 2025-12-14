/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      Empty State Component                                ║
 * ║                                                                           ║
 * ║  空状态提示 - 好品味：单一职责，纯UI组件                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { Code } from "lucide-react";

interface EmptyStateProps {
  fontClass: string;
  t: (key: string) => string;
}

export function EmptyState({ fontClass, t }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-ink-soft">
      <Code size={48} strokeWidth={1} className="mb-4 opacity-50" />
      <p className={`text-lg mb-2 ${fontClass}`}>{t("regexScriptEditor.noScripts")}</p>
      <p className={`text-sm opacity-70 ${fontClass}`}>{t("regexScriptEditor.noScriptsDescription")}</p>
    </div>
  );
}
