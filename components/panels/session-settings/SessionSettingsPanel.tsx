/**
 * @input  @/lib/store/story-session-settings, @/lib/store/model-store, @/components/ui
 * @output SessionSettingsPanel
 * @pos    会话设置面板 - 分层（会话 > 导入预设 > 全局默认）调整采样/模型/预设提示词
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

"use client";

import { useMemo, useState } from "react";
import { Sliders } from "lucide-react";
import { PanelCard } from "@/components/panels/shared/PanelShell";
import { useModelStore } from "@/lib/store/model-store";
import { useStorySessionSettings } from "@/lib/store/story-session-settings";
import { SamplingFields } from "./SamplingFields";
import { PromptOverrideList } from "./PromptOverrideList";

type Scope = "session" | "preset";

export function SessionSettingsPanel() {
  const [scope, setScope] = useState<Scope>("session");
  const dialogueId = useStorySessionSettings((state) => state.dialogueId);
  const blueprintId = useStorySessionSettings((state) => state.blueprintId);
  const settings = useStorySessionSettings((state) => state.settings);
  const promptEntries = useStorySessionSettings((state) => state.promptEntries);
  const setSessionSampling = useStorySessionSettings((state) => state.setSessionSampling);
  const setPresetSampling = useStorySessionSettings((state) => state.setPresetSampling);
  const setSessionModelConfig = useStorySessionSettings((state) => state.setSessionModelConfig);
  const setSessionPromptOverride = useStorySessionSettings((state) => state.setSessionPromptOverride);
  const setPresetPromptOverride = useStorySessionSettings((state) => state.setPresetPromptOverride);

  const configs = useModelStore((state) => state.configs);

  // 这个面板只对 blueprint-backed 的 Story Agent 会话有意义。
  if (!dialogueId || !blueprintId) return null;

  const isSession = scope === "session";
  const samplingValues = isSession ? settings.modelPolicy ?? {} : undefined;

  return (
    <PanelCard>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Sliders className="h-4 w-4" />
          会话设置
        </div>
        <div className="flex overflow-hidden rounded-md border border-border/70 text-xs">
          <ScopeTab label="本会话" active={isSession} onClick={() => setScope("session")} />
          <ScopeTab label="此角色预设" active={!isSession} onClick={() => setScope("preset")} />
        </div>
      </div>

      <p className="mb-3 text-xs leading-5 text-muted-foreground">
        {isSession
          ? "仅作用于当前会话，优先级最高，留空表示沿用导入预设 / 全局默认。"
          : "作用于该角色的所有会话（改写导入预设），会话级设置仍可再覆盖它。"}
      </p>

      <SamplingFields
        scope={scope}
        values={samplingValues}
        onChange={(patch) => (isSession ? setSessionSampling(patch) : setPresetSampling(patch))}
      />

      {isSession ? (
        <ModelSelector
          configs={configs}
          value={settings.modelConfigId}
          onChange={(id) => setSessionModelConfig(id)}
        />
      ) : null}

      <PromptOverrideList
        scope={scope}
        entries={promptEntries}
        overrides={settings.promptOverrides ?? {}}
        onToggle={(id, enabled) =>
          isSession
            ? setSessionPromptOverride(id, { enabled })
            : setPresetPromptOverride(id, { enabled })
        }
        onEditContent={(id, content) =>
          isSession
            ? setSessionPromptOverride(id, { content })
            : setPresetPromptOverride(id, { content })
        }
      />
    </PanelCard>
  );
}

function ScopeTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "bg-primary px-3 py-1 font-medium text-primary-foreground"
          : "px-3 py-1 text-muted-foreground hover:bg-muted"
      }
    >
      {label}
    </button>
  );
}

function ModelSelector({
  configs,
  value,
  onChange,
}: {
  configs: { id: string; name: string; model: string }[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
}) {
  const options = useMemo(() => configs, [configs]);
  return (
    <div className="mt-4">
      <label className="mb-1 block text-xs font-medium text-foreground">模型（本会话）</label>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || undefined)}
        className="w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-sm"
      >
        <option value="">跟随全局当前模型</option>
        {options.map((config) => (
          <option key={config.id} value={config.id}>
            {config.name} · {config.model}
          </option>
        ))}
      </select>
    </div>
  );
}
