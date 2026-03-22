import React, { type ReactNode } from "react";

export interface SessionToolbarProps {
  currentModel: string;
  streamingEnabled: boolean;
  fastModelEnabled: boolean;
  swipeLabel?: string | null;
  apiSelector: ReactNode;
  modeControls: ReactNode;
  swipeControls?: ReactNode;
  t: (key: string) => string;
}

export default function SessionToolbar({
  apiSelector,
  currentModel,
  fastModelEnabled,
  modeControls,
  streamingEnabled,
  swipeControls,
  swipeLabel,
  t,
}: SessionToolbarProps) {
  const streamingStatus = streamingEnabled ? t("Streaming On") : t("Streaming Off");
  const fastStatus = fastModelEnabled ? t("Fast On") : t("Fast Off");

  return (
    <section
      data-session-toolbar="true"
      className="flex items-center justify-between gap-4 px-3 py-2 border-b border-border"
    >
      <div className="flex items-center gap-3">
        {apiSelector}
        {modeControls}
        {swipeControls}
      </div>
      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
        <span>{currentModel}</span>
        <span>{streamingStatus}</span>
        <span>{fastStatus}</span>
        {swipeLabel ? <span>{swipeLabel}</span> : null}
      </div>
    </section>
  );
}
