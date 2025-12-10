/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      Character Card Grid Component                        ║
 * ║                                                                           ║
 * ║  网格式角色卡展示组件                                                       ║
 * ║  点击角色卡时自动创建会话并跳转到 /session 路由                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Tilt from "react-parallax-tilt";
import { ArrowUp, PencilLine, Trash2, UserRound } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { CharacterAvatarBackground } from "@/components/CharacterAvatarBackground";
import { trackButtonClick } from "@/utils/google-analytics";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/lib/store/session-store";
import { toast } from "@/lib/store/toast-store";

/**
 * Interface definitions for the component's data structures
 */
interface Character {
  id: string;
  name: string;
  personality: string;
  scenario?: string;
  first_mes?: string;
  creatorcomment?: string;
  created_at: string;
  avatar_path?: string;
}

interface CharacterCardGridProps {
  characters: Character[];
  onEditClick: (character: Character, e: React.MouseEvent) => void;
  onDeleteClick: (characterId: string) => void;
  onMoveToTopClick: (characterId: string) => void;
  onCharacterSelect?: (characterId: string) => void;
  isCreateSessionMode?: boolean;
  isCreatingSession?: boolean;
}

/**
 * 网格式角色卡组件
 * Requirements: 3.3
 */
const CharacterCardGrid: React.FC<CharacterCardGridProps> = ({
  characters,
  onEditClick,
  onDeleteClick,
  onMoveToTopClick,
  onCharacterSelect,
  isCreateSessionMode = false,
  isCreatingSession: externalIsCreating = false,
}) => {
  const { t, fontClass } = useLanguage();
  const router = useRouter();
  const [internalIsCreating, setInternalIsCreating] = useState(false);
  const { createSession } = useSessionStore();

  const isCreatingSession = externalIsCreating || internalIsCreating;

  /**
   * 处理角色卡点击 - 创建会话并跳转
   * Requirements: 3.3
   */
  const handleCardClick = useCallback(
    async (characterId: string) => {
      if (isCreatingSession) return;

      if (isCreateSessionMode && onCharacterSelect) {
        onCharacterSelect(characterId);
        return;
      }

      setInternalIsCreating(true);
      try {
        const sessionId = await createSession(characterId);
        if (sessionId) {
          router.push(`/session?id=${sessionId}`);
        } else {
          toast.error(t("characterCardsPage.createSessionFailed") || "Failed to create session");
        }
      } catch (error) {
        console.error("Failed to create session:", error);
        toast.error(t("characterCardsPage.createSessionFailed") || "Failed to create session");
      } finally {
        setInternalIsCreating(false);
      }
    },
    [isCreatingSession, isCreateSessionMode, onCharacterSelect, createSession, router, t],
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 animate-in fade-in duration-500">
      {characters.map((character, index) => (
        <div
          key={character.id}
          className="scale-[0.75] sm:scale-[0.85] animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <Tilt
            tiltMaxAngleX={-15}
            tiltMaxAngleY={-15}
            glareEnable={true}
            glareMaxOpacity={0.1}
            glareColor="var(--color-cream)"
            glarePosition="all"
            glareBorderRadius="8px"
            scale={1.02}
            transitionSpeed={2000}
            className="h-full"
          >
            <div className="relative session-card h-full transition-all duration-300">
              {/* Action buttons for each card */}
              <div className="absolute top-1 right-1 sm:top-2 sm:right-2 flex space-x-0.5 sm:space-x-1 z-10">
                {/* move character to top of the screen */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {e.stopPropagation(); trackButtonClick("move_to_top_character_btn", "置顶角色"); onMoveToTopClick(character.id);}}
                  className="p-2 sm:p-1.5 h-auto w-auto bg-muted-surface hover:bg-muted-surface rounded-full text-primary-soft hover:text-highlight"
                  title={t("characterCardsPage.move_to_top")}
                  aria-label={t("characterCardsPage.move_to_top")}
                >
                  <ArrowUp className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {trackButtonClick("edit_character_btn", "编辑角色"); onEditClick(character, e);}}
                  className="p-2 sm:p-1.5 h-auto w-auto bg-muted-surface hover:bg-muted-surface rounded-full text-primary-soft hover:text-highlight"
                  title={t("characterCardsPage.edit")}
                  aria-label={t("characterCardsPage.edit")}
                >
                  <PencilLine className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    trackButtonClick("delete_character_btn", "删除角色");
                    e.stopPropagation();
                    onDeleteClick(character.id);
                  }}
                  className="p-2 sm:p-1.5 h-auto w-auto bg-muted-surface hover:bg-muted-surface rounded-full text-primary-soft hover:text-highlight"
                  title={t("characterCardsPage.delete")}
                  aria-label={t("characterCardsPage.delete")}
                >
                  <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                </Button>
              </div>
            
              {/* 角色卡内容 - 点击创建会话并跳转 */}
              <div
                onClick={() => handleCardClick(character.id)}
                className={`h-full flex flex-col cursor-pointer ${isCreatingSession ? "opacity-50 pointer-events-none" : ""}`}
              >
                <div className="relative w-full overflow-hidden rounded aspect-4/5">
                  {character.avatar_path ? (
                    <CharacterAvatarBackground avatarPath={character.avatar_path} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted-surface">
                      <UserRound className="h-16 w-16 sm:h-24 sm:w-24 text-ink" strokeWidth={1.5} />
                    </div>
                  )}
                </div>
                <div className="p-2 sm:p-4">
                  <h2 className="text-sm sm:text-lg text-cream-soft line-clamp-1 magical-text">{character.name}</h2>
                  <div className={`text-2xs sm:text-xs text-ink-soft mt-1 sm:mt-2 italic ${fontClass}`}>
                    <span className="inline-block mr-1 opacity-70">✨</span>
                    <span className="line-clamp-2">{character.personality}</span>
                  </div>
                </div>
              </div>
            </div>
          </Tilt>
        </div>
      ))}
    </div>
  );
};

export default CharacterCardGrid; 
