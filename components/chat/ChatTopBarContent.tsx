/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                        ChatTopBarContent 聊天头部                   ║
 * ║  合并到全局 TopBar 内渲染，避免重复标题栏。                           ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { BookText, SlidersHorizontal, Regex, UserRound, GitBranch } from "lucide-react";
import { CharacterAvatarBackground } from "@/components/CharacterAvatarBackground";
import { trackButtonClick } from "@/utils/google-analytics";
import { useLanguage } from "@/app/i18n";
import { useUIStore } from "@/lib/store/ui-store";
import { Button } from "@/components/ui/button";

interface ChatTopBarContentProps {
  character?: {
    name: string;
    avatar_path?: string;
  };
  activeView: "chat" | "worldbook" | "regex" | "preset";
  onOpenBranches?: () => void;
}

export function ChatTopBarContent({ character, activeView, onOpenBranches }: ChatTopBarContentProps) {
  const { t } = useLanguage();
  const setCharacterView = useUIStore((state) => state.setCharacterView);
  const name = character?.name ?? (t("characterChat.noCharacter") ?? "未选择角色");

  return (
    <div className="flex items-center gap-4 min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
          {character?.avatar_path ? (
            <CharacterAvatarBackground avatarPath={character.avatar_path} />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted-surface">
              <UserRound className="h-4 w-4 text-ink" strokeWidth={1.5} />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground truncate max-w-[160px]">
            {name}
          </div>
          <div className="text-xs text-muted-foreground truncate max-w-[160px]">
            {t("characterChat.chattingWith") ?? "聊天中"}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
          label={t("characterChat.regex")}
          icon={<Regex className="h-4 w-4" strokeWidth={1.5} />}
          active={activeView === "regex"}
          onClick={() => {
            trackButtonClick("page", "切换正则编辑器");
            setCharacterView(activeView === "regex" ? "chat" : "regex");
          }}
        />
        <IconButton
          label={t("characterChat.preset")}
          icon={<SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} />}
          active={activeView === "preset"}
          onClick={() => {
            trackButtonClick("page", "切换预设编辑器");
            setCharacterView(activeView === "preset" ? "chat" : "preset");
          }}
        />
        <IconButton
          label="剧情分支"
          icon={<GitBranch className="h-4 w-4" strokeWidth={1.5} />}
          onClick={() => {
            trackButtonClick("page", "打开剧情分支");
            onOpenBranches?.();
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
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="gap-2"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
