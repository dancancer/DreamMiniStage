/**
 * @input  react, components/ui/button, lib/mvu, types/character-dialogue
 * @output MvuDebuggerPanel
 * @pos    MVU 调试面板 - /session 中的变量、快照与 schema 可视化入口
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        MVU Debugger Panel                                ║
 * ║                                                                           ║
 * ║  收口当前会话的 MVU 变量查看、消息快照切换、schema 浏览与 delta 预览。        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import MvuStrategyPanel from "@/components/mvu/MvuStrategyPanel";
import MvuStatusBarPreview from "@/components/mvu/MvuStatusBarPreview";
import { getCharacterVariables, getCurrentMvuTrace, getNodeMvuTrace, getNodeVariables } from "@/lib/mvu";
import { buildDefaultStatusBarTemplate, renderStatusBarTemplate } from "@/lib/mvu/debugger/template";
import type { MvuData } from "@/lib/mvu";
import type { ParsedMvuTrace } from "@/lib/models/parsed-response";
import type { DialogueMessage } from "@/types/character-dialogue";

interface Props {
  dialogueId?: string;
  messages: DialogueMessage[];
}

function stringifyPreview(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function countEntries(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return 0;
  }
  return Object.keys(value as Record<string, unknown>).length;
}

function summarizeMessage(message: DialogueMessage, index: number): string {
  const content = message.content?.trim() || "(empty)";
  return `${index + 1}. ${content.slice(0, 24)}${content.length > 24 ? "..." : ""}`;
}

function PreviewBlock(props: { title: string; value: unknown; emptyText: string; dataKey: string }) {
  const { title, value, emptyText, dataKey } = props;
  const hasValue = value && (
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value as Record<string, unknown>).length > 0
  );

  return (
    <div className="min-w-0 rounded-md border border-border bg-background/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </p>
      </div>
      <pre
        data-mvu-preview={dataKey}
        className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs text-foreground"
      >
        {hasValue ? stringifyPreview(value) : emptyText}
      </pre>
    </div>
  );
}

function TraceCard(props: {
  title: string;
  trace: ParsedMvuTrace | null;
  emptyText: string;
  dataKey: string;
}) {
  const { title, trace, emptyText, dataKey } = props;

  return (
    <div className="rounded-md border border-border bg-background/70 p-3">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </p>
      {trace ? (
        <div data-mvu-trace={dataKey} className="mt-2 space-y-1 text-sm text-foreground">
          <p>已选策略：{trace.selectedStrategy}</p>
          <p>{title}：{trace.appliedPath}</p>
          <p>已应用：{trace.applied ? "yes" : "no"}</p>
          <p>协议块：{trace.hasUpdateProtocol ? "yes" : "no"}</p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

export default function MvuDebuggerPanel({ dialogueId, messages }: Props) {
  const [currentVariables, setCurrentVariables] = useState<MvuData | null>(null);
  const [currentTrace, setCurrentTrace] = useState<ParsedMvuTrace | null>(null);
  const [selectedVariables, setSelectedVariables] = useState<MvuData | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<ParsedMvuTrace | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [isLoadingCurrent, setIsLoadingCurrent] = useState(false);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [error, setError] = useState("");
  const [statusBarTemplate, setStatusBarTemplate] = useState("");

  const snapshotCandidates = useMemo(
    () => messages.filter((message) => Boolean(message.id)).slice().reverse(),
    [messages],
  );

  useEffect(() => {
    if (!snapshotCandidates.length) {
      setSelectedMessageId("");
      setSelectedVariables(null);
      return;
    }

    if (!selectedMessageId || !snapshotCandidates.some((message) => message.id === selectedMessageId)) {
      setSelectedMessageId(snapshotCandidates[0].id);
    }
  }, [selectedMessageId, snapshotCandidates]);

  useEffect(() => {
    if (!dialogueId) {
      setCurrentVariables(null);
      return;
    }

    let cancelled = false;
    setIsLoadingCurrent(true);
    setError("");

    void getCharacterVariables({ dialogueKey: dialogueId })
      .then((variables) => {
        if (!cancelled) {
          setCurrentVariables(variables);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setCurrentVariables(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingCurrent(false);
        }
      });

    void getCurrentMvuTrace({ dialogueKey: dialogueId })
      .then((trace) => {
        if (!cancelled) {
          setCurrentTrace(trace);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setCurrentTrace(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dialogueId, messages]);

  useEffect(() => {
    if (!dialogueId || !selectedMessageId) {
      setSelectedVariables(null);
      return;
    }

    let cancelled = false;
    setIsLoadingSnapshot(true);
    setError("");

    void getNodeVariables({ dialogueKey: dialogueId }, selectedMessageId)
      .then((variables) => {
        if (!cancelled) {
          setSelectedVariables(variables);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setSelectedVariables(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSnapshot(false);
        }
      });

    void getNodeMvuTrace({ dialogueKey: dialogueId }, selectedMessageId)
      .then((trace) => {
        if (!cancelled) {
          setSelectedTrace(trace);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setSelectedTrace(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dialogueId, selectedMessageId]);

  useEffect(() => {
    if (statusBarTemplate) {
      return;
    }

    const nextTemplate = buildDefaultStatusBarTemplate(currentVariables);
    if (nextTemplate) {
      setStatusBarTemplate(nextTemplate);
    }
  }, [currentVariables, statusBarTemplate]);

  const currentSummary = currentVariables
    ? `${countEntries(currentVariables.stat_data)} stat / ${countEntries(currentVariables.display_data)} display / ${countEntries(currentVariables.delta_data)} delta`
    : "当前还没有可读变量";
  const selectedSummary = selectedVariables
    ? `${countEntries(selectedVariables.stat_data)} stat / ${countEntries(selectedVariables.delta_data)} delta`
    : "当前消息还没有变量快照";
  const renderedStatusBarTemplate = renderStatusBarTemplate(statusBarTemplate, currentVariables);

  return (
    <div className="flex min-w-0 flex-[1.4] flex-col gap-3 rounded-md border border-border bg-surface/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">MVU Debugger</p>
          <p className="text-xs text-muted-foreground">
            标准工作流里的变量初始化、消息快照、Schema 与 Delta 预览都在这里对齐。
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>当前变量</p>
          <p data-mvu-current-summary="true">{isLoadingCurrent ? "加载中..." : currentSummary}</p>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-3">
          <MvuStrategyPanel />

          <div className="rounded-md border border-border bg-background/70 p-3">
            <div className="mb-3">
              <p className="text-sm font-medium text-foreground">路径观测</p>
              <p className="text-xs text-muted-foreground">
                直接显示当前节点和选中节点到底走了哪条 MVU 路径，而不是只看当前全局策略。
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <TraceCard
                title="当前节点"
                trace={currentTrace}
                emptyText="当前节点还没有 MVU 路径记录。"
                dataKey="current"
              />
              <TraceCard
                title="选中节点"
                trace={selectedTrace}
                emptyText="当前消息快照还没有 MVU 路径记录。"
                dataKey="selected"
              />
            </div>
          </div>

          <div className="rounded-md border border-border bg-background/70 p-3">
            <div className="mb-3">
              <p className="text-sm font-medium text-foreground">状态栏预览</p>
              <p className="text-xs text-muted-foreground">
                用当前会话与当前消息快照直接预览 `status_bar` 的作者可见表达。
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <MvuStatusBarPreview
                title="当前状态栏"
                variables={currentVariables}
                emptyText="当前会话还没有 status_bar。"
                dataKey="current"
              />
              <MvuStatusBarPreview
                title="消息状态栏"
                variables={selectedVariables}
                emptyText="当前消息快照还没有 status_bar。"
                dataKey="selected"
              />
            </div>

            <div className="mt-3 rounded-md border border-border bg-surface/40 p-3">
              <div className="mb-2">
                <p className="text-sm font-medium text-foreground">状态栏模板</p>
                <p className="text-xs text-muted-foreground">
                  使用 {"`{{status_bar.key}}`"} 占位符预览作者模板，不认识的 key 会原样保留。
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_0.9fr]">
                <Textarea
                  value={statusBarTemplate}
                  onChange={(event) => setStatusBarTemplate(event.target.value)}
                  placeholder="例如：生命值: {{status_bar.hp}} | 楼层: {{status_bar.floor}}"
                  data-mvu-status-template-input="true"
                  className="min-h-[96px]"
                />
                <div className="rounded-md border border-border bg-background/70 p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    模板输出
                  </p>
                  <pre
                    data-mvu-status-template-output="true"
                    className="mt-2 whitespace-pre-wrap break-all text-sm text-foreground"
                  >
                    {renderedStatusBarTemplate || "当前还没有可渲染的状态栏模板。"}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border bg-background/70 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">当前变量</p>
                <p className="text-xs text-muted-foreground">读取当前会话最新可用的 MVU 状态。</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <PreviewBlock
                title="Stat"
                value={currentVariables?.stat_data}
                emptyText="当前还没有 stat_data。"
                dataKey="current-stat"
              />
              <PreviewBlock
                title="Display"
                value={currentVariables?.display_data}
                emptyText="当前还没有 display_data。"
                dataKey="current-display"
              />
            </div>
          </div>

          <div className="rounded-md border border-border bg-background/70 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">指定消息快照</p>
                <p className="text-xs text-muted-foreground">切换到任一楼层，查看该时刻保存下来的变量与增量。</p>
              </div>
              <p className="text-xs text-muted-foreground" data-mvu-selected-summary="true">
                {isLoadingSnapshot ? "快照加载中..." : selectedSummary}
              </p>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {snapshotCandidates.length > 0 ? snapshotCandidates.map((message, index) => (
                <Button
                  key={message.id}
                  type="button"
                  size="sm"
                  variant={selectedMessageId === message.id ? "default" : "outline"}
                  data-mvu-message-target={message.id}
                  onClick={() => setSelectedMessageId(message.id)}
                >
                  {summarizeMessage(message, snapshotCandidates.length - index - 1)}
                </Button>
              )) : (
                <span className="text-xs text-muted-foreground">当前还没有可切换的消息快照。</span>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <PreviewBlock
                title="Stat"
                value={selectedVariables?.stat_data}
                emptyText="当前消息没有保存 stat_data。"
                dataKey="selected-stat"
              />
              <PreviewBlock
                title="Delta"
                value={selectedVariables?.delta_data}
                emptyText="当前消息没有 delta_data。"
                dataKey="selected-delta"
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <PreviewBlock
            title="Schema"
            value={selectedVariables?.schema ?? currentVariables?.schema}
            emptyText="当前还没有可展示的 Schema。"
            dataKey="schema"
          />
          <PreviewBlock
            title="Delta"
            value={currentVariables?.delta_data}
            emptyText="当前会话还没有最近一次 delta。"
            dataKey="current-delta"
          />
        </section>
      </div>
    </div>
  );
}
