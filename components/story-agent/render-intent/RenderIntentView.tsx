"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RenderIntent } from "@/lib/story-agent/render-intent";

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
    return (
      <section className="rounded-md border border-border bg-card/80 p-3 text-card-foreground">
        <h3 className="mb-2 text-sm font-semibold">{intent.title}</h3>
        <div className="grid gap-2">
          {intent.options.map((option) => {
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
  return template.replace(/\$(\d+)/g, (match, index: string) => values[index] ?? match);
}
