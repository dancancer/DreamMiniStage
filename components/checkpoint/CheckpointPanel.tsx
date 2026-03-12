"use client";

import React, { useMemo } from "react";

import { useCheckpointStore } from "@/lib/checkpoint/store";

interface Props {
  dialogueId?: string;
  messages: Array<{ id: string; content?: string }>;
}

export default function CheckpointPanel({ dialogueId, messages }: Props) {
  const dialogueMap = useCheckpointStore((state) => state.dialogues);
  const resolvedDialogueId = dialogueId || "";

  const summary = useMemo(() => {
    if (!resolvedDialogueId) {
      return {
        currentCheckpoint: "",
        entries: [] as string[],
      };
    }

    const record = dialogueMap[resolvedDialogueId];
    const entries = messages
      .map((message, index) => {
        const checkpoint = record?.messageToCheckpoint?.[message.id];
        return checkpoint ? `${index}: ${checkpoint}` : null;
      })
      .filter((entry): entry is string => Boolean(entry));

    return {
      currentCheckpoint: record?.currentCheckpoint || "",
      entries,
    };
  }, [dialogueMap, messages, resolvedDialogueId]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-md border border-border bg-surface/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Checkpoint / Branch</p>
          <p className="text-xs text-muted-foreground">当前分支：{summary.currentCheckpoint || "main"}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {summary.entries.length > 0 ? summary.entries.map((entry) => (
          <span
            key={entry}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground"
          >
            {entry}
          </span>
        )) : (
          <span className="text-xs text-muted-foreground">当前还没有 checkpoint</span>
        )}
      </div>
    </div>
  );
}
