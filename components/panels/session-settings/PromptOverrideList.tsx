/**
 * @input  @/components/ui, @/lib/store/story-session-settings
 * @output PromptOverrideList
 * @pos    会话设置 - 导入预设提示词条目的开关/改写列表
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { StorySessionPromptOverride } from "@/lib/story-agent/runtime/story-session";
import type { StoryPromptEntryView } from "@/lib/store/story-session-settings";

export function PromptOverrideList({
  scope,
  entries,
  overrides,
  onToggle,
  onEditContent,
}: {
  scope: "session" | "preset";
  entries: StoryPromptEntryView[];
  overrides: Record<string, StorySessionPromptOverride>;
  onToggle: (id: string, enabled: boolean) => void;
  onEditContent: (id: string, content: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (entries.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="mb-2 text-xs font-medium text-foreground">
        预设提示词（{entries.length}）
      </div>
      <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {entries.map((entry) => {
          const override = overrides[entry.id];
          // session scope：有效开关 = 会话覆盖 ?? 预设状态。preset scope：直接是预设状态。
          const enabled = scope === "session" ? override?.enabled ?? entry.enabled : entry.enabled;
          const content = override?.content ?? entry.content;
          const expanded = expandedId === entry.id;
          return (
            <div key={entry.id} className="rounded-md border border-border/50">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : entry.id)}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label={expanded ? "收起" : "展开"}
                >
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <span className="min-w-0 flex-1 truncate text-xs text-foreground" title={preview(content)}>
                  <span className="text-muted-foreground">{entry.role}</span>
                  {" · "}
                  {preview(content) || "（空）"}
                </span>
                <Switch
                  checked={enabled}
                  onCheckedChange={(value) => onToggle(entry.id, value === true)}
                />
              </div>
              {expanded ? (
                <PromptContentEditor
                  initial={content}
                  onSave={(next) => onEditContent(entry.id, next)}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PromptContentEditor({ initial, onSave }: { initial: string; onSave: (content: string) => void }) {
  const [draft, setDraft] = useState(initial);
  const dirty = draft !== initial;
  return (
    <div className="space-y-2 border-t border-border/50 p-2">
      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={5}
        className="text-xs"
      />
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="outline" disabled={!dirty} onClick={() => onSave(draft)}>
          保存改写
        </Button>
      </div>
    </div>
  );
}

function preview(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 60);
}
