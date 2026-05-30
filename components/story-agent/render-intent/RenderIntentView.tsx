"use client";

import type React from "react";
import { Activity, ChevronDown, Clock, Database, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChoiceOption, RenderIntent } from "@/lib/story-agent/render-intent";

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
    const stateData = parseStatePanelData(resolveTemplate(intent.dataTemplate, values));
    if (stateData) return <StoryStatePanel data={stateData} intent={intent} />;
    return null;
  }

  const statusData = intent.kind === "status-panel" && intent.dataTemplate
    ? parseStatusData(resolveTemplate(intent.dataTemplate, values))
    : null;
  if (intent.kind === "status-panel" && statusData) {
    return <StatusPanel intent={intent} data={statusData} />;
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

interface StatusCharacter {
  name?: string;
  status?: string;
  relation?: string;
  pose?: string;
  clothing?: string;
  location?: string;
  thought?: string;
}

interface StatusData {
  date?: string;
  time?: string;
  location?: string;
  characters: StatusCharacter[];
}

interface StatePanelUpdate {
  op?: string;
  path?: string;
  value?: unknown;
}

interface StatePanelData {
  updated: StatePanelUpdate[];
  snapshot: Record<string, unknown>;
  errors: string[];
}

function StoryStatePanel({ intent, data }: { intent: RenderIntent; data: StatePanelData }) {
  const snapshotEntries = Object.entries(data.snapshot);
  return (
    <section className="rounded-md border border-primary/25 bg-card/85 p-4 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          <div className="text-xs uppercase text-muted-foreground">Story State</div>
          <h3 className="mt-1 text-sm font-semibold">{intent.title}</h3>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <StatusMeta icon={<Activity className="h-3.5 w-3.5" />} value={`${data.updated.length} updates`} />
          <StatusMeta icon={<Database className="h-3.5 w-3.5" />} value={`${snapshotEntries.length} fields`} />
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {data.updated.length > 0 ? (
          <div className="grid gap-2">
            {data.updated.map((item, index) => (
              <div
                className="grid gap-1 rounded-md border border-border/75 bg-background/45 px-3 py-2 text-sm sm:grid-cols-[5rem_1fr]"
                key={`${item.op ?? "update"}-${item.path ?? index}`}
              >
                <span className="font-medium uppercase text-primary">{item.op ?? "set"}</span>
                <span className="min-w-0 break-words text-muted-foreground">
                  {item.path}
                  {item.value !== undefined ? ` = ${formatPanelValue(item.value)}` : ""}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {snapshotEntries.length > 0 ? (
          <dl className="grid gap-2 border-t border-border/60 pt-3 text-sm">
            {snapshotEntries.map(([key, value]) => (
              <div className="grid gap-1 sm:grid-cols-[8rem_1fr]" key={key}>
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="min-w-0 break-words">{formatPanelValue(value)}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {data.errors.length > 0 ? (
          <p className="rounded-md border border-destructive/25 px-3 py-2 text-sm text-destructive">
            {data.errors.slice(0, 3).join(" / ")}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function StatusPanel({ intent, data }: { intent: RenderIntent; data: StatusData }) {
  return (
    <section className="rounded-md border border-primary/25 bg-card/85 p-4 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          <div className="text-xs uppercase text-muted-foreground">Story Status</div>
          <h3 className="mt-1 text-sm font-semibold">{intent.title}</h3>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <StatusMeta icon={<Clock className="h-3.5 w-3.5" />} value={[data.date, data.time].filter(Boolean).join(" ")} />
          <StatusMeta icon={<MapPin className="h-3.5 w-3.5" />} value={data.location} />
          <StatusMeta icon={<Users className="h-3.5 w-3.5" />} value={`${data.characters.length} characters`} />
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {data.characters.map((character, index) => (
          <article
            className="rounded-md border border-border/75 bg-background/45 p-3"
            key={`${character.name ?? "character"}-${index}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">{character.name || `Character ${index + 1}`}</h4>
              {character.relation ? (
                <span className="rounded-md border border-primary/20 px-2 py-0.5 text-xs text-primary">
                  {character.relation}
                </span>
              ) : null}
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <StatusField label="状态" value={character.status} />
              <StatusField label="位置" value={character.location} />
              <StatusField label="姿态" value={character.pose} />
              <StatusField label="服装" value={character.clothing} />
            </dl>
            {character.thought ? (
              <p className="mt-3 border-t border-border/60 pt-3 text-sm italic text-muted-foreground">
                {character.thought}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function StatusMeta({ icon, value }: { icon: React.ReactNode; value?: string }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-1">
      {icon}
      {value}
    </span>
  );
}

function StatusField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[3rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function resolveTemplate(template: string, values: Record<string, string>): string {
  return template
    .replace(/\$json\.([a-zA-Z0-9_]+)/g, (match, key: string) => {
      const data = parseStatusData(values[1] ?? "");
      const value = data?.[key as keyof StatusData];
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

function parseStatusData(value: string): StatusData | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const characters = Array.isArray(parsed.characters)
      ? parsed.characters.map(normalizeCharacter)
      : [];
    return {
      date: readString(parsed.date),
      time: readString(parsed.time),
      location: readString(parsed.location),
      characters,
    };
  } catch {
    return null;
  }
}

function parseStatePanelData(value: string): StatePanelData | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      updated: Array.isArray(parsed.updated)
        ? parsed.updated.map(normalizeStateUpdate)
        : [],
      snapshot: normalizeSnapshot(parsed.snapshot),
      errors: Array.isArray(parsed.errors)
        ? parsed.errors.filter((item): item is string => typeof item === "string")
        : [],
    };
  } catch {
    return null;
  }
}

function normalizeStateUpdate(value: unknown): StatePanelUpdate {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    op: readString(record.op),
    path: readString(record.path),
    value: record.value,
  };
}

function normalizeSnapshot(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeCharacter(value: unknown): StatusCharacter {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    name: readString(record.name),
    status: readString(record.status),
    relation: readString(record.relation),
    pose: readString(record.pose),
    clothing: readString(record.clothing),
    location: readString(record.location),
    thought: readString(record.thought),
  };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function formatPanelValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  return JSON.stringify(value) ?? String(value);
}
