"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { PresetOperations } from "@/lib/data/roleplay/preset-operation";
import { BUILT_IN_CONTEXT_PRESETS, INSTRUCT_PRESET_DEFINITIONS } from "@/lib/prompt-config/catalog";
import {
  selectPromptPresetById,
  setPromptPostProcessingValue,
  setPromptStopStrings,
  setPromptSyspromptState,
  updatePromptInstructState,
} from "@/lib/prompt-config/service";
import { buildEffectivePromptConfigSummary } from "@/lib/prompt-config/state";
import { usePromptConfigStore } from "@/lib/store/prompt-config-store";
import { toast } from "@/lib/store/toast-store";
import type { Preset } from "@/lib/models/preset-model";
import { PostProcessingMode } from "@/lib/core/st-preset-types";

const POST_PROCESSING_OPTIONS = [
  PostProcessingMode.NONE,
  PostProcessingMode.MERGE,
  PostProcessingMode.SEMI,
  PostProcessingMode.STRICT,
  PostProcessingMode.SINGLE,
] as const;

export function PromptBehaviorPanel() {
  const activePresetId = usePromptConfigStore((state) => state.activePresetId);
  const activePresetName = usePromptConfigStore((state) => state.activePresetName);
  const instruct = usePromptConfigStore((state) => state.instruct);
  const context = usePromptConfigStore((state) => state.context);
  const sysprompt = usePromptConfigStore((state) => state.sysprompt);
  const stopStrings = usePromptConfigStore((state) => state.stopStrings);
  const promptPostProcessing = usePromptConfigStore((state) => state.promptPostProcessing);
  const setActivePreset = usePromptConfigStore((state) => state.setActivePreset);
  const setContext = usePromptConfigStore((state) => state.setContext);
  const replaceContext = usePromptConfigStore((state) => state.replaceContext);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(true);
  const [stopStringText, setStopStringText] = useState("");

  const effectivePresetId = useMemo(() => {
    if (activePresetId) {
      return activePresetId;
    }
    const active = presets.find((preset) => preset.enabled !== false);
    return active?.id || "";
  }, [activePresetId, presets]);

  const effectiveSummary = useMemo(() => {
    return buildEffectivePromptConfigSummary({
      activePresetName,
      instruct,
      context,
      sysprompt,
      stopStrings,
      promptPostProcessing,
    });
  }, [activePresetName, instruct, context, sysprompt, stopStrings, promptPostProcessing]);

  useEffect(() => {
    let active = true;

    PresetOperations.getAllPresets()
      .then((items) => {
        if (!active) {
          return;
        }
        setPresets(items);
      })
      .catch((error) => {
        console.error("[PromptBehaviorPanel] 加载预设失败:", error);
        toast.error("加载预设失败");
      })
      .finally(() => {
        if (active) {
          setIsLoadingPresets(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setStopStringText(stopStrings.join("\n"));
  }, [stopStrings]);

  useEffect(() => {
    if (activePresetId || presets.length === 0) {
      return;
    }

    const activePreset = presets.find((preset) => preset.enabled !== false);
    if (activePreset) {
      setActivePreset(activePreset);
    }
  }, [activePresetId, presets, setActivePreset]);

  const handlePresetChange = useCallback(async (value: string) => {
    if (!value) {
      return;
    }

    try {
      await selectPromptPresetById(value);
      const refreshed = await PresetOperations.getAllPresets();
      setPresets(refreshed);
    } catch (error) {
      console.error("[PromptBehaviorPanel] 切换预设失败:", error);
      toast.error(error instanceof Error ? error.message : "切换预设失败");
    }
  }, []);

  const handleInstructEnabledChange = useCallback((enabled: boolean) => {
    updatePromptInstructState({ enabled });
  }, []);

  const handleInstructPresetChange = useCallback((presetName: string) => {
    updatePromptInstructState({
      enabled: true,
      preset: presetName,
    });
  }, []);

  const handleContextPresetChange = useCallback((presetName: string) => {
    const preset = BUILT_IN_CONTEXT_PRESETS.find((item) => item.name === presetName);
    if (!preset) {
      return;
    }
    replaceContext(preset);
  }, [replaceContext]);

  const handleStopStringsChange = useCallback((value: string) => {
    setStopStringText(value);
    setPromptStopStrings(value.split("\n"));
  }, []);

  const handlePromptPostProcessingChange = useCallback((value: string) => {
    setPromptPostProcessingValue(value);
  }, []);

  return (
    <div className="space-y-6 text-sm text-foreground">
      <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
        <div>
          <div className="text-sm font-medium">Preset / Instruct</div>
          <div className="text-xs text-muted-foreground">预设启用、instruct 模式与 slash 共用同一状态源。</div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="prompt-active-preset">当前预设</Label>
            <Select value={effectivePresetId || undefined} onValueChange={handlePresetChange}>
              <SelectTrigger id="prompt-active-preset">
                <SelectValue placeholder={isLoadingPresets ? "加载中..." : "选择预设"} />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id || preset.name}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 rounded-md border border-border bg-background/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">Instruct Mode</div>
                <div className="text-xs text-muted-foreground">开启后将按所选模板规整最终消息结构。</div>
              </div>
              <Switch checked={instruct.enabled} onCheckedChange={handleInstructEnabledChange} />
            </div>
            <Select value={instruct.preset || "Roleplay"} onValueChange={handleInstructPresetChange}>
              <SelectTrigger>
                <SelectValue placeholder="选择 instruct 模板" />
              </SelectTrigger>
              <SelectContent>
                {INSTRUCT_PRESET_DEFINITIONS.map((preset) => (
                  <SelectItem key={preset.name} value={preset.name}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              {INSTRUCT_PRESET_DEFINITIONS.find((preset) => preset.name === (instruct.preset || "Roleplay"))?.description}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
        <div>
          <div className="text-sm font-medium">Context / Sysprompt</div>
          <div className="text-xs text-muted-foreground">Context preset 负责故事字符串，sysprompt 负责额外 system 与 post-history 注入。</div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt-context-preset">Context Preset</Label>
          <Select value={context.name} onValueChange={handleContextPresetChange}>
            <SelectTrigger id="prompt-context-preset">
              <SelectValue placeholder="选择 context preset" />
            </SelectTrigger>
            <SelectContent>
              {BUILT_IN_CONTEXT_PRESETS.map((preset) => (
                <SelectItem key={preset.name} value={preset.name}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Story String">
            <Textarea
              value={context.story_string}
              onChange={(event) => setContext({ story_string: event.target.value })}
              className="min-h-28"
            />
          </Field>
          <div className="grid gap-4">
            <Field label="Example Separator">
              <Input
                value={context.example_separator}
                onChange={(event) => setContext({ example_separator: event.target.value })}
              />
            </Field>
            <Field label="Chat Start">
              <Input
                value={context.chat_start}
                onChange={(event) => setContext({ chat_start: event.target.value })}
              />
            </Field>
          </div>
        </div>

        <div className="rounded-md border border-border bg-background/50 p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">System Prompt</div>
              <div className="text-xs text-muted-foreground">slash `/sysprompt*` 与此处共享名称与启用状态。</div>
            </div>
            <Switch
              checked={sysprompt.enabled}
              onCheckedChange={(enabled) => setPromptSyspromptState({ enabled })}
            />
          </div>
          <Field label="Sysprompt Name">
            <Input
              value={sysprompt.name}
              onChange={(event) => setPromptSyspromptState({ name: event.target.value })}
            />
          </Field>
          <Field label="System Content">
            <Textarea
              value={sysprompt.content}
              onChange={(event) => setPromptSyspromptState({ content: event.target.value })}
              className="min-h-24"
            />
          </Field>
          <Field label="Post History Content">
            <Textarea
              value={sysprompt.post_history || ""}
              onChange={(event) => setPromptSyspromptState({ post_history: event.target.value })}
              className="min-h-20"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
        <div>
          <div className="text-sm font-medium">Stop Strings / Post Processing</div>
          <div className="text-xs text-muted-foreground">停止词与 prompt-post-processing 会直接进入真实生成链路。</div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Stop Strings">
            <Textarea
              value={stopStringText}
              onChange={(event) => handleStopStringsChange(event.target.value)}
              className="min-h-28"
              placeholder="每行一个 stop string"
            />
          </Field>
          <Field label="Prompt Post-Processing">
            <Select value={promptPostProcessing} onValueChange={handlePromptPostProcessingChange}>
              <SelectTrigger>
                <SelectValue placeholder="选择后处理模式" />
              </SelectTrigger>
              <SelectContent>
                {POST_PROCESSING_OPTIONS.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {mode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-background/60 p-4">
        <div className="text-sm font-medium">最终生效配置</div>
        <div className="grid gap-3 md:grid-cols-2">
          <SummaryItem label="Preset" value={effectiveSummary.presetName || "未启用"} />
          <SummaryItem label="Instruct" value={effectiveSummary.instructEnabled ? (effectiveSummary.instructPreset || "已启用") : "关闭"} />
          <SummaryItem label="Context" value={effectiveSummary.contextName} />
          <SummaryItem label="Sysprompt" value={effectiveSummary.syspromptEnabled ? effectiveSummary.syspromptName : "关闭"} />
          <SummaryItem label="Post" value={effectiveSummary.promptPostProcessing} />
          <SummaryItem label="Stops" value={effectiveSummary.stopStrings.length > 0 ? effectiveSummary.stopStrings.join(" | ") : "无"} />
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm text-foreground">{value}</div>
    </div>
  );
}
