/**
 * @input  lib/story-agent/import, components/ui
 * @output PreviewDetails, previewDetailLabels
 * @pos    Story Agent 导入预览明细 - 展示开场预览与可操作诊断
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    Story Agent Import Preview Details                     ║
 * ║  在创建 Agent 前暴露编译结果，让用户看到语义损失和实际首屏开场。              ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { AlertTriangle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ImportDiagnostic } from "@/lib/adapters/import";
import type { StoryAgentImportPreview } from "@/lib/story-agent/import";

interface PreviewDetailsProps {
  preview: StoryAgentImportPreview;
  copy: PreviewDetailCopy;
}

export interface PreviewDetailCopy {
  openingTitle: string;
  openingMeta: string;
  featureLossTitle: string;
  diagnosticsTitle: string;
  noFeatureLoss: string;
  showingDiagnostics: (shown: number, total: number) => string;
}

const FEATURE_LOSS_PRIORITY: Record<string, number> = {
  "character.instruction_only_opening": 0,
  "regex.ui_html_unsupported": 1,
  "render.status_contract_unsupported": 2,
  "extension.unsupported": 3,
};

const FEATURE_LOSS_CODES = new Set(Object.keys(FEATURE_LOSS_PRIORITY));

export function PreviewDetails({ preview, copy }: PreviewDetailsProps) {
  const opening = preview.blueprint.profile.openings[0];
  const featureLosses = preview.diagnostics
    .filter(isFeatureLossDiagnostic)
    .sort(compareDiagnostics);
  const diagnostics = prioritizedDiagnostics(preview.diagnostics).slice(0, 12);

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.25fr]">
      <section className="rounded-md border border-border/70 bg-card/45 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileText className="h-4 w-4 text-primary" />
          {copy.openingTitle}
        </div>
        {opening && (
          <div className="mt-2 text-xs text-muted-foreground">
            {copy.openingMeta}: {opening.id} · {opening.sourceField}
          </div>
        )}
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border/60 bg-background/65 p-3 text-xs leading-5 text-foreground">
          {opening?.content || ""}
        </pre>
      </section>

      <section className="rounded-md border border-border/70 bg-card/45 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <AlertTriangle className="h-4 w-4 text-primary" />
          {copy.featureLossTitle}
        </div>
        {featureLosses.length > 0 ? (
          <div className="mt-3 space-y-2">
            {featureLosses.map((diagnostic) => (
              <DiagnosticRow key={diagnosticKey(diagnostic)} diagnostic={diagnostic} />
            ))}
          </div>
        ) : (
          <div className="mt-3 text-xs text-muted-foreground">{copy.noFeatureLoss}</div>
        )}

        {diagnostics.length > 0 && (
          <div className="mt-4 border-t border-border/60 pt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-medium text-muted-foreground">
                {copy.diagnosticsTitle}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {copy.showingDiagnostics(diagnostics.length, preview.diagnostics.length)}
              </div>
            </div>
            <div className="mt-2 max-h-48 overflow-auto space-y-2 pr-1">
              {diagnostics.map((diagnostic) => (
                <DiagnosticRow key={diagnosticKey(diagnostic)} diagnostic={diagnostic} compact />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export function previewDetailLabels(language: string): PreviewDetailCopy {
  const zh = language === "zh";
  return {
    openingTitle: zh ? "首屏开场预览" : "First Opening Preview",
    openingMeta: zh ? "来源" : "Source",
    featureLossTitle: zh ? "语义损失与自动适配" : "Feature Loss and Repairs",
    diagnosticsTitle: zh ? "诊断明细" : "Diagnostics",
    noFeatureLoss: zh ? "未发现需要用户关注的语义损失。" : "No feature-loss diagnostics need attention.",
    showingDiagnostics: (shown, total) =>
      zh ? `显示 ${shown}/${total}` : `Showing ${shown}/${total}`,
  };
}

function DiagnosticRow({
  diagnostic,
  compact,
}: {
  diagnostic: ImportDiagnostic;
  compact?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background/55 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={diagnostic.severity === "error" ? "destructive" : "outline"}>
          {diagnostic.severity}
        </Badge>
        <code className="text-xs text-foreground">{diagnostic.code}</code>
      </div>
      <div className={compact ? "mt-1 text-xs text-muted-foreground" : "mt-2 text-xs text-foreground"}>
        {diagnostic.message}
      </div>
      {(diagnostic.targetPath || diagnostic.sourceField) && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          {[diagnostic.targetPath, diagnostic.sourceField].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}

function isFeatureLossDiagnostic(diagnostic: ImportDiagnostic): boolean {
  return FEATURE_LOSS_CODES.has(diagnostic.code);
}

function prioritizedDiagnostics(diagnostics: ImportDiagnostic[]): ImportDiagnostic[] {
  return [...diagnostics].sort(compareDiagnostics);
}

function compareDiagnostics(left: ImportDiagnostic, right: ImportDiagnostic): number {
  const severityRank = { error: 0, warning: 1, info: 2 };
  return (
    featureLossRank(left) - featureLossRank(right) ||
    severityRank[left.severity] - severityRank[right.severity] ||
    left.code.localeCompare(right.code) ||
    (left.targetPath ?? "").localeCompare(right.targetPath ?? "")
  );
}

function featureLossRank(diagnostic: ImportDiagnostic): number {
  return FEATURE_LOSS_PRIORITY[diagnostic.code] ?? 99;
}

function diagnosticKey(diagnostic: ImportDiagnostic): string {
  return [
    diagnostic.severity,
    diagnostic.code,
    diagnostic.targetPath,
    diagnostic.sourceField,
    diagnostic.message,
  ].filter(Boolean).join("|");
}
