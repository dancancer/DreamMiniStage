"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileText,
  Regex,
  SlidersHorizontal,
  UploadCloud,
} from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  commitStoryAgentFromPreview,
  previewStoryAgentFromFiles,
} from "@/function/story-agent/import";
import type {
  StoryAgentImportPreview,
  StoryAgentImportResult,
} from "@/lib/story-agent/import";
import { toast } from "@/lib/store/toast-store";
import { cn } from "@/lib/utils";
import {
  PreviewDetails,
  previewDetailLabels,
} from "./PreviewDetails";

type FileKind = "character" | "preset" | "worldbook" | "regex";

interface FilePickerProps {
  kind: FileKind;
  label: string;
  icon: React.ReactNode;
  accept: string;
  files: File[];
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}

export function StoryAgentImportWizard() {
  const router = useRouter();
  const { language, fontClass } = useLanguage();
  const [characterFiles, setCharacterFiles] = useState<File[]>([]);
  const [presetFiles, setPresetFiles] = useState<File[]>([]);
  const [worldBookFiles, setWorldBookFiles] = useState<File[]>([]);
  const [regexFiles, setRegexFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<StoryAgentImportPreview | null>(null);
  const [result, setResult] = useState<StoryAgentImportResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const copy = useMemo(() => labels(language), [language]);
  const characterFile = characterFiles[0] ?? null;

  const runPreview = async () => {
    if (!characterFile) {
      toast.error(copy.characterRequired);
      return;
    }

    setIsPreviewing(true);
    setResult(null);
    setConfirmed(false);
    try {
      const nextPreview = await previewStoryAgentFromFiles({
        characterFile,
        presetFile: presetFiles[0] ?? null,
        worldBookFiles,
        regexFiles,
      });
      setPreview(nextPreview);
      toast.success(copy.previewReady);
    } catch (error) {
      console.error("Story Agent preview failed:", error);
      toast.error(error instanceof Error ? error.message : copy.previewFailed);
    } finally {
      setIsPreviewing(false);
    }
  };

  const commit = async () => {
    if (!preview) return;
    if (preview.confirmation.required && !confirmed) {
      toast.error(copy.confirmRequired);
      return;
    }

    setIsCommitting(true);
    try {
      const nextResult = await commitStoryAgentFromPreview({
        blueprint: preview.blueprint,
        avatarFile: characterFile,
      });
      setResult(nextResult);
      toast.success(copy.created);
    } catch (error) {
      console.error("Story Agent commit failed:", error);
      toast.error(error instanceof Error ? error.message : copy.commitFailed);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <main className={cn("h-full overflow-y-auto px-4 py-8", fontClass)}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-border/70 pb-5">
          <Badge variant="outline" className="w-fit border-primary/30 text-primary">
            Story Agent Compiler
          </Badge>
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">
              {copy.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {copy.subtitle}
            </p>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2">
          <FilePicker
            kind="character"
            label={copy.character}
            icon={<FileText className="h-4 w-4" />}
            accept=".png,.json,application/json,image/png"
            files={characterFiles}
            onFiles={(files) => setCharacterFiles(files.slice(0, 1))}
          />
          <FilePicker
            kind="preset"
            label={copy.preset}
            icon={<SlidersHorizontal className="h-4 w-4" />}
            accept=".json,application/json"
            files={presetFiles}
            onFiles={(files) => setPresetFiles(files.slice(0, 1))}
          />
          <FilePicker
            kind="worldbook"
            label={copy.worldbook}
            icon={<BookOpen className="h-4 w-4" />}
            accept=".json,application/json"
            files={worldBookFiles}
            multiple
            onFiles={setWorldBookFiles}
          />
          <FilePicker
            kind="regex"
            label={copy.regex}
            icon={<Regex className="h-4 w-4" />}
            accept=".json,application/json"
            files={regexFiles}
            multiple
            onFiles={setRegexFiles}
          />
        </section>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={runPreview}
            disabled={!characterFile || isPreviewing || isCommitting}
          >
            {isPreviewing ? copy.previewing : copy.preview}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={commit}
            disabled={!preview || isCommitting || isPreviewing}
          >
            {isCommitting ? copy.creating : copy.create}
          </Button>
          {result && (
            <Button type="button" variant="ghost" onClick={() => router.push(`/session?id=${result.sessionId}`)}>
              {copy.enterSession}
            </Button>
          )}
        </div>

        {preview && (
          <SummaryPanel
            preview={preview}
            confirmed={confirmed}
            onConfirmedChange={setConfirmed}
            copy={copy}
          />
        )}

        {result && (
          <div className="rounded-md border border-primary/25 bg-primary/10 p-4 text-sm text-foreground">
            <div className="flex items-center gap-2 font-medium text-primary">
              <CheckCircle2 className="h-4 w-4" />
              {copy.created}
            </div>
            <div className="mt-2 text-muted-foreground">
              {result.summary.characterName} · {result.blueprintId}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function FilePicker({
  label,
  icon,
  accept,
  files,
  multiple,
  onFiles,
}: FilePickerProps) {
  const fileNames = files.map((file) => file.name).join(", ");

  return (
    <label className="flex min-h-28 cursor-pointer flex-col justify-between rounded-md border border-border/75 bg-card/45 p-4 transition-colors hover:border-primary/30 hover:bg-card/70">
      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
        {icon}
        {label}
      </span>
      <span className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <UploadCloud className="h-4 w-4" />
        <span className="truncate">{fileNames || "No file selected"}</span>
      </span>
      <input
        type="file"
        className="sr-only"
        accept={accept}
        multiple={multiple}
        onChange={(event) => onFiles(Array.from(event.target.files ?? []))}
      />
    </label>
  );
}

function SummaryPanel({
  preview,
  confirmed,
  onConfirmedChange,
  copy,
}: {
  preview: StoryAgentImportPreview;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
  copy: ReturnType<typeof labels>;
}) {
  const rows = [
    [copy.summaryCharacter, preview.summary.characterName],
    [copy.summaryOpenings, String(preview.summary.openingCount)],
    [copy.summaryPrompt, String(preview.summary.promptMessageCount)],
    [copy.summaryWorldbook, `${preview.summary.worldBookCount} / ${preview.summary.worldBookEntryCount}`],
    [copy.summaryRegex, String(preview.summary.regexScriptCount)],
    [copy.summaryRender, String(preview.summary.renderRuleCount)],
    [copy.summaryDiagnostics, String(preview.summary.diagnosticCount)],
    [copy.summaryRepairs, repairSummary(preview)],
  ];

  return (
    <section className="rounded-md border border-border/75 bg-background/55 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="border-b border-border/60 pb-2">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 truncate text-sm font-medium text-foreground">{value}</div>
          </div>
        ))}
      </div>

      <PreviewDetails
        preview={preview}
        copy={previewDetailLabels(copy.language)}
      />

      {preview.confirmation.required && (
        <div className="mt-4 rounded-md border border-destructive/25 bg-destructive/10 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {copy.needsConfirmation}
          </div>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {preview.confirmation.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(value) => onConfirmedChange(value === true)}
            />
            {copy.confirm}
          </label>
        </div>
      )}
    </section>
  );
}

function labels(language: string) {
  const zh = language === "zh";
  return {
    language,
    title: zh ? "导入 Story Agent" : "Import Story Agent",
    subtitle: zh
      ? "选择角色卡、世界书、预设和正则后，系统会先编译成 SessionBlueprint，再创建可直接进入的叙事会话。"
      : "Select assets, compile them into a SessionBlueprint, then create a ready-to-run story session.",
    character: zh ? "角色卡" : "Character card",
    preset: zh ? "预设" : "Preset",
    worldbook: zh ? "世界书" : "Worldbook",
    regex: zh ? "正则" : "Regex",
    preview: zh ? "检查资产" : "Inspect Assets",
    previewing: zh ? "检查中..." : "Inspecting...",
    create: zh ? "创建 Agent" : "Create Agent",
    creating: zh ? "创建中..." : "Creating...",
    enterSession: zh ? "进入会话" : "Enter Session",
    previewReady: zh ? "资产检查完成" : "Preview ready",
    previewFailed: zh ? "资产检查失败" : "Preview failed",
    commitFailed: zh ? "创建失败" : "Creation failed",
    characterRequired: zh ? "请先选择角色卡" : "Select a character card first",
    confirmRequired: zh ? "请先确认高风险变更" : "Confirm high-risk changes first",
    created: zh ? "Agent 已创建" : "Agent created",
    needsConfirmation: zh ? "需要人工确认" : "Manual confirmation required",
    confirm: zh ? "我已确认这些变更" : "I confirm these changes",
    summaryCharacter: zh ? "角色" : "Character",
    summaryOpenings: zh ? "开场" : "Openings",
    summaryPrompt: zh ? "Prompt" : "Prompt",
    summaryWorldbook: zh ? "世界书/条目" : "Worldbooks / entries",
    summaryRegex: zh ? "正则规则" : "Regex rules",
    summaryRender: zh ? "UI 渲染规则" : "Render rules",
    summaryDiagnostics: zh ? "诊断" : "Diagnostics",
    summaryRepairs: zh ? "修复" : "Repairs",
  };
}

function repairSummary(preview: StoryAgentImportPreview): string {
  const report = preview.blueprint.repairReport;
  return `${report.appliedPatches.length} / ${report.manualPatches.length} / ${report.rejectedPatches.length}`;
}
