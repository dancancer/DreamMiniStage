/**
 * @input  @/components, @/app/session, next/navigation
 * @output SessionToolsPanel
 * @pos    功能面板组件
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                        SessionToolsPanel 会话工具面板               ║
 * ║  收纳低频会话工具：Quick Reply、群聊成员、Checkpoint / Branch。      ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, GitBranch, Globe, Grid, Link2, Upload, Download, User, Wrench } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import QuickReplyPanel from "@/components/quick-reply/QuickReplyPanel";
import GroupMemberPanel from "@/components/group-chat/GroupMemberPanel";
import CheckpointPanel from "@/components/checkpoint/CheckpointPanel";
import { useSessionStore } from "@/lib/store/session-store";
import { useSessionToolModesStore } from "@/lib/store/session-tool-modes";
import {
  dispatchExportJsonlEvent,
  dispatchImportJsonlEvent,
  dispatchOpenBranchesEvent,
  dispatchOpenScriptDebugEvent,
  dispatchOpenUserNameModalEvent,
} from "@/app/session/session-ui-events";
import { PanelCard, PanelShell } from "@/components/panels/shared/PanelShell";

const LazyPromptViewerButton = dynamic(
  () => import("@/components/prompt-viewer/PromptViewerButton"),
  {
    ssr: false,
    loading: () => null,
  },
);

export function SessionToolsPanel() {
  const searchParams = useSearchParams();
  const dialogueId = searchParams.get("id") || undefined;
  const getSessionById = useSessionStore((state) => state.getSessionById);
  const activeModes = useSessionToolModesStore((state) => state.activeModes);
  const toggleStoryProgress = useSessionToolModesStore((state) => state.toggleStoryProgress);
  const cyclePerspective = useSessionToolModesStore((state) => state.cyclePerspective);
  const toggleSceneSetting = useSessionToolModesStore((state) => state.toggleSceneSetting);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const session = dialogueId ? getSessionById(dialogueId) : undefined;
  const characterId = session?.characterId;

  const perspectiveLabel = useMemo(() => {
    if (!activeModes.perspective.active) {
      return "关闭";
    }

    return activeModes.perspective.mode === "novel"
      ? "小说视角"
      : "主角视角";
  }, [activeModes.perspective.active, activeModes.perspective.mode]);

  return (
    <PanelShell
      title="会话工具"
      description="收纳低频操作，避免让聊天主界面承担过多管理噪音。"
      bodyClassName="space-y-4"
      embeddedHeaderMode="none"
    >
      <PanelCard>
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Wrench className="h-4 w-4" />
          叙事模式
        </div>
        <div className="grid gap-2">
          <ModeButton
            label="剧情推进"
            status={activeModes["story-progress"] ? "已启用" : "关闭"}
            icon={<ArrowRight className="h-4 w-4" />}
            onClick={toggleStoryProgress}
          />
          <ModeButton
            label="视角设计"
            status={perspectiveLabel}
            icon={<Globe className="h-4 w-4" />}
            onClick={cyclePerspective}
          />
          <ModeButton
            label="场景过渡"
            status={activeModes["scene-setting"] ? "已启用" : "关闭"}
            icon={<Grid className="h-4 w-4" />}
            onClick={toggleSceneSetting}
          />
        </div>
      </PanelCard>

      <PanelCard>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-foreground">Checkpoint / Branch</div>
            <div className="text-xs text-muted-foreground">
              需要查看分支结构或切换 checkpoint 时再打开。
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={dispatchOpenBranchesEvent}>
            <GitBranch className="mr-2 h-4 w-4" />
            打开分支树
          </Button>
        </div>
      </PanelCard>

      <PanelCard>
        <div className="mb-3 text-sm font-medium text-foreground">会话辅助</div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={dispatchOpenUserNameModalEvent}>
            <User className="mr-2 h-4 w-4" />
            用户名称
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={dispatchOpenScriptDebugEvent}>
            <Link2 className="mr-2 h-4 w-4" />
            Script Debug
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={dispatchExportJsonlEvent}>
            <Download className="mr-2 h-4 w-4" />
            导出 JSONL
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            导入 JSONL
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jsonl,application/x-ndjson,text/plain"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            dispatchImportJsonlEvent(file);
            event.target.value = "";
          }}
        />
      </PanelCard>

      {dialogueId && characterId ? (
        <PanelCard>
          <div className="mb-3 text-sm font-medium text-foreground">提示词查看</div>
          <LazyPromptViewerButton dialogueKey={dialogueId} characterId={characterId} />
        </PanelCard>
      ) : null}

      <QuickReplyPanel dialogueId={dialogueId} />
      <GroupMemberPanel dialogueId={dialogueId} />
      <CheckpointPanel dialogueId={dialogueId} />
    </PanelShell>
  );
}

function ModeButton({
  label,
  status,
  icon,
  onClick,
}: {
  label: string;
  status: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto justify-between gap-4 px-3 py-3"
      onClick={onClick}
    >
      <span className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </span>
      <span className="text-xs text-muted-foreground">{status}</span>
    </Button>
  );
}
