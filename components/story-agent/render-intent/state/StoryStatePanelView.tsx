"use client";

import type React from "react";
import { Activity, Database } from "lucide-react";
import type { RenderIntent } from "@/lib/story-agent/render-intent";

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

interface SnapshotField {
  label: string;
  value: string;
  description?: string;
}

export function StoryStatePanelView({ intent, data }: { intent: RenderIntent; data: StatePanelData }) {
  const fields = snapshotFields(data.snapshot);
  return (
    <section className="rounded-md border border-primary/25 bg-card/85 p-4 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div>
          <div className="text-xs uppercase text-muted-foreground">Story State</div>
          <h3 className="mt-1 text-sm font-semibold">{intent.title}</h3>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <StateMeta icon={<Activity className="h-3.5 w-3.5" />} value={countLabel(data.updated.length, "update")} />
          <StateMeta icon={<Database className="h-3.5 w-3.5" />} value={countLabel(fields.length, "field")} />
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
                  {item.value !== undefined ? ` = ${formatStateValue(item.value)}` : ""}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {fields.length > 0 ? (
          <dl className="grid gap-2 border-t border-border/60 pt-3 text-sm">
            {fields.map((field) => (
              <div className="grid gap-1 sm:grid-cols-[10rem_1fr]" key={field.label}>
                <dt className="text-muted-foreground">{field.label}</dt>
                <dd className="min-w-0 break-words">
                  <span>{field.value}</span>
                  {field.description ? (
                    <span className="mt-1 block text-xs text-muted-foreground">{field.description}</span>
                  ) : null}
                </dd>
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

export function parseStoryStatePanelData(value: string): StatePanelData | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      updated: Array.isArray(parsed.updated) ? parsed.updated.map(normalizeStateUpdate) : [],
      snapshot: isRecord(parsed.snapshot) ? parsed.snapshot : {},
      errors: Array.isArray(parsed.errors)
        ? parsed.errors.filter((item): item is string => typeof item === "string")
        : [],
    };
  } catch {
    return null;
  }
}

function snapshotFields(snapshot: Record<string, unknown>): SnapshotField[] {
  return Object.entries(snapshot).flatMap(([name, value]) => flattenSnapshot(name, value));
}

function flattenSnapshot(prefix: string, value: unknown): SnapshotField[] {
  if (isStateTuple(value)) return [{ label: prefix, value: formatStateValue(value[0]), description: readString(value[1]) }];
  if (!isRecord(value)) return [{ label: prefix, value: formatStateValue(value) }];
  return Object.entries(value)
    .filter(([key]) => key !== "$meta")
    .flatMap(([key, child]) => flattenSnapshot(`${prefix}.${key}`, child));
}

function normalizeStateUpdate(value: unknown): StatePanelUpdate {
  const record = isRecord(value) ? value : {};
  return {
    op: readString(record.op),
    path: readString(record.path),
    value: record.value,
  };
}

function StateMeta({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-1">
      {icon}
      {value}
    </span>
  );
}

function countLabel(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function isStateTuple(value: unknown): value is [unknown, unknown] {
  return Array.isArray(value) && value.length >= 2;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function formatStateValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  return JSON.stringify(value) ?? String(value);
}
