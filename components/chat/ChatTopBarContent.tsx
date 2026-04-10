/**
 * @input  @/components, @/utils, @/app, @/lib
 * @output ChatTopBarContent
 * @pos    聊天相关组件
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 *
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                        ChatTopBarContent 聊天头部                   ║
 * ║  合并到全局 TopBar 内渲染，避免重复标题栏。                           ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { BookText, UserRound, Wrench } from "lucide-react";
import { CharacterAvatarBackground } from "@/components/CharacterAvatarBackground";
import { trackButtonClick } from "@/utils/google-analytics";
import { useLanguage } from "@/app/i18n";
import { useUIStore } from "@/lib/store/ui-store";
import { useUiLayout } from "@/contexts/ui-layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatTopBarContentProps {
  character?: {
    name: string;
    avatar_path?: string;
  };
  activeView: "chat" | "worldbook" | "regex" | "preset";
}

export function ChatTopBarContent({ character, activeView }: ChatTopBarContentProps) {
  const { t } = useLanguage();
  const setCharacterView = useUIStore((state) => state.setCharacterView);
  const { openPanel } = useUiLayout();
  const name = character?.name ?? (t("characterChat.noCharacter") ?? "未选择角色");
  const stageLabel = activeView === "worldbook"
    ? t("characterChat.worldBook")
    : activeView === "preset"
      ? "预设"
      : activeView === "regex"
        ? "正则脚本"
        : "叙事中";

  return (
    <div className="flex min-w-0 items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-background/45">
          {character?.avatar_path ? (
            <CharacterAvatarBackground avatarPath={character.avatar_path} />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-muted-surface">
              <UserRound className="h-4 w-4 text-ink" strokeWidth={1.5} />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.26em] text-primary-soft/70">
            {stageLabel}
          </div>
          <div className="max-w-[180px] truncate text-sm font-semibold text-foreground">
            {name}
          </div>
          <div className="max-w-[220px] truncate text-xs text-ink-soft">
            {t("characterChat.chattingWith") ?? "聊天中"}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <IconButton
          label={t("characterChat.worldBook")}
          icon={<BookText className="h-4 w-4" strokeWidth={1.5} />}
          active={activeView === "worldbook"}
          onClick={() => {
            trackButtonClick("page", "切换世界书");
            setCharacterView(activeView === "worldbook" ? "chat" : "worldbook");
          }}
        />
        <IconButton
          label="会话工具"
          icon={<Wrench className="h-4 w-4" strokeWidth={1.5} />}
          onClick={() => {
            trackButtonClick("page", "打开会话工具");
            openPanel("sessionTools");
          }}
        />
      </div>
    </div>
  );
}

function IconButton({
  label,
  icon,
  active,
  onClick,
}: {
  label?: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn(
        "h-10 gap-2 rounded-full border border-border/70 bg-background/45 px-3 text-ink-soft hover:border-primary/20 hover:bg-primary/10 hover:text-foreground",
        active && "border-primary/25 bg-primary/12 text-primary",
      )}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </Button>
  );
}
