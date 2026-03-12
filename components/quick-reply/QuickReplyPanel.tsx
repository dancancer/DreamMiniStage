"use client";

import React, { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type QuickReplyRecord,
  type QuickReplySetRecord,
  useQuickReplyStore,
} from "@/lib/quick-reply/store";

interface Props {
  dialogueId?: string;
  onExecuteQuickReply: (index: number) => void | Promise<void>;
}

function summarizeSetScope(scope: string, visible: boolean): string {
  return `${scope}${visible ? "" : " (hidden)"}`;
}

function createReplySummary(reply: QuickReplyRecord): string {
  return reply.hidden ? `${reply.label} (hidden)` : reply.label;
}

export default function QuickReplyPanel({ dialogueId, onExecuteQuickReply }: Props) {
  const setMap = useQuickReplyStore((state) => state.sets);
  const globalSetEntries = useQuickReplyStore((state) => state.globalSets);
  const chatSetMap = useQuickReplyStore((state) => state.chatSets);
  const createQuickReplySet = useQuickReplyStore((state) => state.createQuickReplySet);
  const addGlobalQuickReplySet = useQuickReplyStore((state) => state.addGlobalQuickReplySet);
  const removeGlobalQuickReplySet = useQuickReplyStore((state) => state.removeGlobalQuickReplySet);
  const addChatQuickReplySet = useQuickReplyStore((state) => state.addChatQuickReplySet);
  const removeChatQuickReplySet = useQuickReplyStore((state) => state.removeChatQuickReplySet);
  const createQuickReply = useQuickReplyStore((state) => state.createQuickReply);
  const deleteQuickReply = useQuickReplyStore((state) => state.deleteQuickReply);
  const deleteQuickReplySet = useQuickReplyStore((state) => state.deleteQuickReplySet);

  const [selectedSetName, setSelectedSetName] = useState("");
  const [newSetName, setNewSetName] = useState("");
  const [newSetNosend, setNewSetNosend] = useState(false);
  const [newReplyLabel, setNewReplyLabel] = useState("");
  const [newReplyMessage, setNewReplyMessage] = useState("");
  const [newReplyHidden, setNewReplyHidden] = useState(false);

  const chatSetEntries = useMemo(() => chatSetMap[dialogueId || ""] || [], [chatSetMap, dialogueId]);

  const quickReplySets = useMemo(() => {
    return Object.values(setMap)
      .map((set) => ({ ...set, replies: set.replies.map((reply) => ({ ...reply, contextSets: reply.contextSets.map((entry) => ({ ...entry })) })) }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [setMap]);

  const activeGlobalSets = useMemo(() => {
    return globalSetEntries.map((entry) => ({ ...entry, scope: "global" as const }));
  }, [globalSetEntries]);

  const activeChatSets = useMemo(() => {
    return chatSetEntries.map((entry) => ({ ...entry, scope: "chat" as const }));
  }, [chatSetEntries]);

  const visibleReplies = useMemo(() => {
    return [...activeGlobalSets, ...activeChatSets]
      .filter((entry) => entry.visible)
      .flatMap((entry) => {
        const quickReplySet = setMap[entry.name] as QuickReplySetRecord | undefined;
        if (!quickReplySet) {
          return [];
        }
        return quickReplySet.replies
          .filter((reply) => !reply.hidden)
          .map((reply) => ({
            scope: entry.scope,
            set: quickReplySet,
            reply,
          }));
      });
  }, [activeChatSets, activeGlobalSets, setMap]);

  useEffect(() => {
    if (!quickReplySets.length) {
      setSelectedSetName("");
      return;
    }
    if (!selectedSetName || !quickReplySets.some((set) => set.name === selectedSetName)) {
      setSelectedSetName(quickReplySets[0].name);
    }
  }, [quickReplySets, selectedSetName]);

  const selectedSet = useMemo(() => {
    return quickReplySets.find((set) => set.name === selectedSetName) || null;
  }, [quickReplySets, selectedSetName]);

  const isGlobalActive = selectedSet
    ? activeGlobalSets.some((entry) => entry.name === selectedSet.name)
    : false;
  const isChatActive = selectedSet && dialogueId
    ? activeChatSets.some((entry) => entry.name === selectedSet.name)
    : false;

  const handleCreateSet = (): void => {
    const name = newSetName.trim();
    if (!name) {
      return;
    }
    createQuickReplySet(name, { nosend: newSetNosend });
    addGlobalQuickReplySet(name, { visible: true });
    setSelectedSetName(name);
    setNewSetName("");
    setNewSetNosend(false);
  };

  const handleCreateReply = (): void => {
    if (!selectedSet) {
      return;
    }
    const label = newReplyLabel.trim();
    const message = newReplyMessage.trim();
    if (!label || !message) {
      return;
    }
    createQuickReply(selectedSet.name, label, message, { hidden: newReplyHidden });
    setNewReplyLabel("");
    setNewReplyMessage("");
    setNewReplyHidden(false);
  };

  const activeSummary = [...activeGlobalSets, ...activeChatSets]
    .map((entry) => summarizeSetScope(entry.scope, entry.visible))
    .join(", ");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visibleReplies.map((entry, index) => (
        <Button
          key={`${entry.scope}:${entry.set.name}:${entry.reply.id}`}
          type="button"
          variant="outline"
          size="sm"
          data-quick-reply-index={index}
          className="bg-overlay hover:bg-muted-surface border-border text-primary-soft"
          onClick={() => void onExecuteQuickReply(index)}
        >
          {entry.reply.label}
        </Button>
      ))}

      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="border-border bg-surface">
            Quick Reply
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Quick Reply 面板</DialogTitle>
            <DialogDescription>
              管理集合、当前会话启用状态，以及可执行的快捷回复。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-4">
              <div className="rounded-md border border-border bg-surface/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">当前可见条目</p>
                    <p className="text-xs text-muted-foreground">
                      {visibleReplies.length > 0 ? `${visibleReplies.length} 条` : "暂无可执行 Quick Reply"}
                    </p>
                  </div>
                  {activeSummary && (
                    <p className="text-xs text-muted-foreground">{activeSummary}</p>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {visibleReplies.map((entry) => (
                    <span
                      key={`chip:${entry.scope}:${entry.set.name}:${entry.reply.id}`}
                      className="rounded-full border border-border px-3 py-1 text-xs text-foreground"
                    >
                      {entry.reply.label} · {entry.scope}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-border bg-surface/60 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">创建集合</p>
                <div className="grid gap-2">
                  <Label htmlFor="quick-reply-set-name">集合名称</Label>
                  <Input
                    id="quick-reply-set-name"
                    value={newSetName}
                    onChange={(event) => setNewSetName(event.target.value)}
                    placeholder="例如：Main"
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div>
                    <p className="text-sm text-foreground">nosend</p>
                    <p className="text-xs text-muted-foreground">启用后点击只回填输入框，不直接发送。</p>
                  </div>
                  <Switch checked={newSetNosend} onCheckedChange={setNewSetNosend} />
                </div>
                <Button type="button" onClick={handleCreateSet}>创建并全局启用</Button>
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-md border border-border bg-surface/60 p-4 space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="quick-reply-selected-set">当前集合</Label>
                  <Input
                    id="quick-reply-selected-set"
                    list="quick-reply-set-list"
                    value={selectedSetName}
                    onChange={(event) => setSelectedSetName(event.target.value)}
                    placeholder="选择或输入集合名称"
                  />
                  <datalist id="quick-reply-set-list">
                    {quickReplySets.map((set) => (
                      <option key={set.name} value={set.name} />
                    ))}
                  </datalist>
                </div>

                {selectedSet && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={isGlobalActive ? "default" : "outline"}
                        onClick={() => {
                          if (isGlobalActive) {
                            removeGlobalQuickReplySet(selectedSet.name);
                            return;
                          }
                          addGlobalQuickReplySet(selectedSet.name, { visible: true });
                        }}
                      >
                        {isGlobalActive ? "移除全局" : "启用全局"}
                      </Button>
                      <Button
                        type="button"
                        variant={isChatActive ? "default" : "outline"}
                        disabled={!dialogueId}
                        onClick={() => {
                          if (!dialogueId) {
                            return;
                          }
                          if (isChatActive) {
                            removeChatQuickReplySet(dialogueId, selectedSet.name);
                            return;
                          }
                          addChatQuickReplySet(dialogueId, selectedSet.name, { visible: true });
                        }}
                      >
                        {isChatActive ? "移除会话" : "启用会话"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => deleteQuickReplySet(selectedSet.name, dialogueId)}
                      >
                        删除集合
                      </Button>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="quick-reply-label">新增回复标签</Label>
                      <Input
                        id="quick-reply-label"
                        value={newReplyLabel}
                        onChange={(event) => setNewReplyLabel(event.target.value)}
                        placeholder="例如：Hello"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="quick-reply-message">消息内容</Label>
                      <Textarea
                        id="quick-reply-message"
                        value={newReplyMessage}
                        onChange={(event) => setNewReplyMessage(event.target.value)}
                        placeholder="可以是普通文本，也可以是 /slash 命令"
                        rows={4}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <div>
                        <p className="text-sm text-foreground">隐藏条目</p>
                        <p className="text-xs text-muted-foreground">隐藏后不出现在底部可见按钮带。</p>
                      </div>
                      <Switch checked={newReplyHidden} onCheckedChange={setNewReplyHidden} />
                    </div>
                    <Button type="button" onClick={handleCreateReply}>添加回复</Button>

                    <div className="rounded-md border border-border p-3">
                      <p className="text-sm font-medium text-foreground">集合内条目</p>
                      <div className="mt-3 space-y-2">
                        {selectedSet.replies.map((reply) => (
                          <div
                            key={reply.id}
                            className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm text-foreground">{createReplySummary(reply)}</p>
                              <p className="truncate text-xs text-muted-foreground">{reply.message}</p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteQuickReply(selectedSet.name, { id: reply.id })}
                            >
                              删除
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
