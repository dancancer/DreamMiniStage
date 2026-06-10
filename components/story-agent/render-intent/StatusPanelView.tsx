"use client";

import type React from "react";
import { Clock, Gauge, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RenderIntent } from "@/lib/story-agent/render-intent";

interface StatusCharacter {
  name?: string;
  status?: string;
  relation?: string;
  pose?: string;
  clothing?: string;
  location?: string;
  thought?: string;
}

interface StatusFieldItem {
  label: string;
  value: string;
  description?: string;
}

interface StatusSection {
  title: string;
  fields: StatusFieldItem[];
}

interface StatusMeter {
  label: string;
  value: string;
  max?: string;
  unit?: string;
  description?: string;
}

interface StatusData {
  date?: string;
  time?: string;
  location?: string;
  characters: StatusCharacter[];
  sections: StatusSection[];
  meters: StatusMeter[];
}

export function StatusPanelView({ intent, data }: { intent: RenderIntent; data: StatusData }) {
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
          <StatusMeta icon={<Gauge className="h-3.5 w-3.5" />} value={countLabel(data.meters.length, "meters")} />
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

        {data.meters.length > 0 ? (
          <div className="grid gap-2">
            {data.meters.map((meter, index) => (
              <MeterRow key={`${meter.label}-${index}`} meter={meter} />
            ))}
          </div>
        ) : null}

        {data.sections.map((section, index) => (
          <section
            className="rounded-md border border-border/75 bg-background/45 p-3"
            key={`${section.title}-${index}`}
          >
            <h4 className="text-sm font-semibold">{section.title}</h4>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {section.fields.map((field, fieldIndex) => (
                <StatusField
                  description={field.description}
                  key={`${field.label}-${fieldIndex}`}
                  label={field.label}
                  value={field.value}
                />
              ))}
            </dl>
          </section>
        ))}
      </div>
    </section>
  );
}

export function parseStatusPanelData(value: string): StatusData | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      date: readString(parsed.date),
      time: readString(parsed.time),
      location: readString(parsed.location),
      characters: Array.isArray(parsed.characters)
        ? parsed.characters.map(normalizeCharacter)
        : [],
      sections: normalizeSections(parsed.sections),
      meters: normalizeMeters(parsed.meters),
    };
  } catch {
    return null;
  }
}

function MeterRow({ meter }: { meter: StatusMeter }) {
  const percent = meterPercent(meter);
  const valueText = meter.max ? `${meter.value}/${meter.max}${meter.unit ?? ""}` : `${meter.value}${meter.unit ?? ""}`;
  return (
    <div className="rounded-md border border-border/75 bg-background/45 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{meter.label}</span>
        <span className="text-muted-foreground">{valueText}</span>
      </div>
      {percent !== undefined ? (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            aria-label={`${meter.label} ${valueText}`}
            className="h-full rounded-full bg-primary"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
      {meter.description ? (
        <p className="mt-2 text-xs text-muted-foreground">{meter.description}</p>
      ) : null}
    </div>
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

function StatusField({ label, value, description }: { label: string; value?: string; description?: string }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        <span className={cn("break-words", description && "block")}>{value}</span>
        {description ? <span className="block text-xs text-muted-foreground">{description}</span> : null}
      </dd>
    </div>
  );
}

function normalizeSections(value: unknown): StatusSection[] {
  if (Array.isArray(value)) return value.map(normalizeSection).filter(isStatusSection);
  if (!isRecord(value)) return [];
  return Object.entries(value).map(([title, fields]) => ({
    title,
    fields: normalizeFields(fields),
  })).filter((section) => section.fields.length > 0);
}

function normalizeSection(value: unknown, index: number): StatusSection | null {
  if (!isRecord(value)) return null;
  const fields = normalizeFields(value.fields ?? value.items ?? value.values ?? value);
  if (fields.length === 0) return null;
  return {
    title: readString(value.title) ?? readString(value.name) ?? `Section ${index + 1}`,
    fields,
  };
}

function normalizeFields(value: unknown): StatusFieldItem[] {
  if (Array.isArray(value)) return value.map(normalizeField).filter(isStatusFieldItem);
  if (!isRecord(value)) return [];
  return Object.entries(value)
    .filter(([key]) => !["title", "name", "sections", "meters", "characters", "date", "time", "location", "mode"].includes(key))
    .map(([label, field]) => ({
      label,
      value: formatPanelValue(field),
    }));
}

function normalizeField(value: unknown, index: number): StatusFieldItem | null {
  if (!isRecord(value)) return { label: `Field ${index + 1}`, value: formatPanelValue(value) };
  const label = readString(value.label) ?? readString(value.name) ?? readString(value.key);
  const fieldValue = value.value ?? value.text ?? value.status;
  if (!label || fieldValue === undefined) return null;
  return {
    label,
    value: formatPanelValue(fieldValue),
    description: readString(value.description),
  };
}

function normalizeMeters(value: unknown): StatusMeter[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => isRecord(item) ? normalizeMeter(item) : null)
    .filter(isStatusMeter);
}

function normalizeMeter(value: Record<string, unknown>): StatusMeter | null {
  const label = readString(value.label) ?? readString(value.name) ?? readString(value.key);
  const meterValue = value.value ?? value.current;
  if (!label || meterValue === undefined) return null;
  return {
    label,
    value: formatPanelValue(meterValue),
    max: value.max === undefined ? undefined : formatPanelValue(value.max),
    unit: readString(value.unit),
    description: readString(value.description),
  };
}

function normalizeCharacter(value: unknown): StatusCharacter {
  const record = isRecord(value) ? value : {};
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

function meterPercent(meter: StatusMeter): number | undefined {
  const value = Number(meter.value);
  const max = Number(meter.max);
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return undefined;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function countLabel(count: number, label: string): string | undefined {
  return count > 0 ? `${count} ${label}` : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStatusSection(value: StatusSection | null): value is StatusSection {
  return value !== null;
}

function isStatusFieldItem(value: StatusFieldItem | null): value is StatusFieldItem {
  return value !== null;
}

function isStatusMeter(value: StatusMeter | null): value is StatusMeter {
  return value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function formatPanelValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  return JSON.stringify(value) ?? String(value);
}
