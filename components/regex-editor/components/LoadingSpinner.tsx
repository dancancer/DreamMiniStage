/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      Loading Spinner Component                           ║
 * ║                                                                           ║
 * ║  加载状态 - 好品味：单一职责，纯UI组件                                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

interface LoadingSpinnerProps {
  t: (key: string) => string;
}

export function LoadingSpinner({ t }: LoadingSpinnerProps) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-t-primary-bright border-r-primary-soft border-b-ink-soft border-l-transparent animate-spin" />
          <div className="absolute inset-2 rounded-full border-2 border-t-ink-soft border-r-primary-bright border-b-primary-soft border-l-transparent animate-spin-slow" />
        </div>
        <p className="mt-4 text-primary-soft">{t("regexScriptEditor.loading") || "Loading..."}</p>
      </div>
    </div>
  );
}
