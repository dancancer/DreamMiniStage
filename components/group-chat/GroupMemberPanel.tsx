"use client";

import React, { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGroupChatStore } from "@/lib/group-chat/store";

const EMPTY_MEMBERS: ReturnType<typeof useGroupChatStore.getState>["listGroupMembers"] extends (dialogueId: string) => infer Result
  ? Result
  : never = [];

interface Props {
  dialogueId?: string;
}

export default function GroupMemberPanel({ dialogueId }: Props) {
  const resolvedDialogueId = dialogueId || "";
  const dialogueMap = useGroupChatStore((state) => state.dialogues);
  const addGroupMember = useGroupChatStore((state) => state.addGroupMember);
  const removeGroupMember = useGroupChatStore((state) => state.removeGroupMember);
  const moveGroupMember = useGroupChatStore((state) => state.moveGroupMember);
  const setGroupMemberEnabled = useGroupChatStore((state) => state.setGroupMemberEnabled);
  const [draftMemberName, setDraftMemberName] = useState("");
  const [error, setError] = useState("");

  const members = useMemo(() => {
    if (!resolvedDialogueId) {
      return EMPTY_MEMBERS;
    }
    return (dialogueMap[resolvedDialogueId]?.members || EMPTY_MEMBERS).map((member) => ({ ...member }));
  }, [dialogueMap, resolvedDialogueId]);

  const handleAdd = (): void => {
    if (!resolvedDialogueId) {
      setError("当前会话还没有可用的群聊上下文");
      return;
    }

    try {
      addGroupMember(resolvedDialogueId, draftMemberName);
      setDraftMemberName("");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const runMemberAction = (action: () => void): void => {
    try {
      action();
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-md border border-border bg-surface/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">群聊成员</p>
          <p className="text-xs text-muted-foreground">
            {members.length > 0 ? `${members.length} 名成员` : "当前仍是单角色会话"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {members.map((member) => (
            <span
              key={member.id}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground"
            >
              {member.name}{member.enabled ? "" : " · off"}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          value={draftMemberName}
          onChange={(event) => setDraftMemberName(event.target.value)}
          placeholder="添加群成员，例如 Alice"
          data-group-member-input="true"
        />
        <Button type="button" onClick={handleAdd} data-group-member-add="true">
          添加成员
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <div className="flex flex-col gap-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-foreground">{member.name}</p>
              <p className="text-xs text-muted-foreground">
                {member.enabled ? "已启用" : "已停用"}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-group-member-toggle={member.name}
                onClick={() => runMemberAction(() => setGroupMemberEnabled(resolvedDialogueId, member.name, !member.enabled))}
              >
                {member.enabled ? "停用" : "启用"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-group-member-up={member.name}
                onClick={() => runMemberAction(() => moveGroupMember(resolvedDialogueId, member.name, "up"))}
              >
                上移
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-group-member-down={member.name}
                onClick={() => runMemberAction(() => moveGroupMember(resolvedDialogueId, member.name, "down"))}
              >
                下移
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-group-member-remove={member.name}
                onClick={() => runMemberAction(() => removeGroupMember(resolvedDialogueId, member.name))}
              >
                移除
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
