"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChoiceOption, RenderIntent } from "@/lib/story-agent/render-intent";
import {
  parseStatusPanelData,
  StatusPanelView,
} from "./StatusPanelView";
import { parseStoryStatePanelData, StoryStatePanelView } from "./state/StoryStatePanelView";

interface RenderIntentViewProps {
  intent: RenderIntent;
  values?: Record<string, string>;
  onAppendInput?: (value: string) => void;
}

export function RenderIntentView({
  intent,
  values = {},
  onAppendInput,
}: RenderIntentViewProps) {
  if (intent.kind === "choice-list") {
    const options = resolveChoiceOptions(intent, values);
    if (options.length === 0) return null;
    return (
      <section className="rounded-md border border-border bg-card/80 p-3 text-card-foreground">
        <h3 className="mb-2 text-sm font-semibold">{intent.title}</h3>
        <div className="grid gap-2">
          {options.map((option) => {
            const label = resolveTemplate(option.labelTemplate, values);
            const description = option.descriptionTemplate
              ? resolveTemplate(option.descriptionTemplate, values)
              : undefined;
            return (
              <Button
                className="h-auto justify-start whitespace-normal px-3 py-2 text-left"
                key={option.id}
                onClick={() => onAppendInput?.(resolveTemplate(option.action.valueTemplate, values))}
                type="button"
                variant="outline"
              >
                <span className="flex flex-col gap-1">
                  <span>{label}</span>
                  {description ? (
                    <span className="text-xs font-normal text-muted-foreground">{description}</span>
                  ) : null}
                </span>
              </Button>
            );
          })}
        </div>
      </section>
    );
  }

  if (intent.kind === "collapsible-panel") {
    return (
      <details className="rounded-md border border-border bg-card/80 p-3 text-card-foreground">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold">
          <span>{intent.title}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </summary>
        <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {resolveTemplate(intent.bodyTemplate, values)}
        </div>
      </details>
    );
  }

  if (intent.kind === "state-panel") {
    const stateData = parseStoryStatePanelData(resolveTemplate(intent.dataTemplate, values));
    if (stateData) return <StoryStatePanelView data={stateData} intent={intent} />;
    return null;
  }

  const statusData = intent.kind === "status-panel" && intent.dataTemplate
    ? parseStatusPanelData(resolveTemplate(intent.dataTemplate, values))
    : null;
  if (intent.kind === "status-panel" && statusData) {
    return <StatusPanelView intent={intent} data={statusData} />;
  }

  return (
    <section className="rounded-md border border-border bg-card/80 p-3 text-card-foreground">
      <h3 className="mb-2 text-sm font-semibold">{intent.title}</h3>
      <dl className="grid gap-2">
        {intent.fields.map((field) => (
          <div
            className={cn("grid grid-cols-[7rem_1fr] gap-3 text-sm")}
            key={field.label}
          >
            <dt className="text-muted-foreground">{field.label}</dt>
            <dd>{resolveTemplate(field.valueTemplate, values)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function resolveTemplate(template: string, values: Record<string, string>): string {
  return template
    .replace(/\$json\.([a-zA-Z0-9_]+)/g, (match, key: string) => {
      const data = parseStatusPanelData(values[1] ?? "");
      const value = data ? (data as unknown as Record<string, unknown>)[key] : undefined;
      return typeof value === "string" ? value : match;
    })
    .replace(/\$(\d+)/g, (match, index: string) => values[index] ?? match);
}

function resolveChoiceOptions(
  intent: Extract<RenderIntent, { kind: "choice-list" }>,
  values: Record<string, string>,
): ChoiceOption[] {
  const dynamicOptions = intent.dataTemplate
    ? parseChoiceData(resolveTemplate(intent.dataTemplate, values))
    : [];
  return dynamicOptions.length > 0 ? dynamicOptions : intent.options;
}

function parseChoiceData(value: string): ChoiceOption[] {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const options = Array.isArray(parsed.options) ? parsed.options : [];
    return options.map(normalizeChoiceOption).filter((item): item is ChoiceOption => item !== null);
  } catch {
    return [];
  }
}

function normalizeChoiceOption(value: unknown, index: number): ChoiceOption | null {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const label = readString(record.label);
  const actionValue = readString(record.value) ?? label;
  if (!label || !actionValue) return null;
  return {
    id: readString(record.id) ?? `action-${index + 1}`,
    labelTemplate: label,
    descriptionTemplate: readString(record.description),
    action: {
      type: "append-input" as const,
      valueTemplate: actionValue,
    },
  };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
