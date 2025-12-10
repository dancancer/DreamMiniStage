/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    Character Card Carousel Component                      ║
 * ║                                                                           ║
 * ║  3D 旋转木马式角色卡展示组件                                                ║
 * ║  点击角色卡时自动创建会话并跳转到 /session 路由                              ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, PencilLine, Trash2, UserRound } from "lucide-react";
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

interface CharacterCardCarouselProps {
  characters: Character[];
  onEditClick: (character: Character, e: React.MouseEvent) => void;
  onDeleteClick: (characterId: string) => void;
  onCharacterSelect?: (characterId: string) => void;
  isCreateSessionMode?: boolean;
  isCreatingSession?: boolean;
}

/**
 * 3D 旋转木马角色卡组件
 * Requirements: 3.3
 */
const CharacterCardCarousel: React.FC<CharacterCardCarouselProps> = ({
  characters,
  onEditClick,
  onDeleteClick,
  onCharacterSelect,
  isCreateSessionMode = false,
  isCreatingSession: externalIsCreating = false,
}) => {
  const { t, fontClass } = useLanguage();
  const router = useRouter();
  const [currentCenterIndex, setCurrentCenterIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
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

  // Calculate carousel parameters based on number of cards
  const cardCount = Math.min(characters.length, 8);
  const angleStep = cardCount > 0 ? 360 / cardCount : 120;
  const translateZDistance = cardCount <= 3 ? 30 : Math.max(25, 30 - (cardCount - 3) * 2);

  /**
   * Handle carousel rotation to the left
   * Prevents multiple rotations during animation
   */
  const handleRotateLeft = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentCenterIndex(prev => (prev + 1) % cardCount);
    setTimeout(() => setIsAnimating(false), 800);
  };

  /**
   * Handle carousel rotation to the right
   * Prevents multiple rotations during animation
   */
  const handleRotateRight = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentCenterIndex(prev => (prev - 1 + cardCount) % cardCount);
    setTimeout(() => setIsAnimating(false), 800);
  };

  return (
    <div className="relative w-full h-[70vh] max-h-[600px] my-12 pt-40 flex items-center justify-center [perspective:1500px]">
      {/* 3D carousel container */}
      <div 
        className="w-full h-full absolute transform-style-preserve-3d"
        style={{
          transformOrigin: "center center 0px",
          transformStyle: "preserve-3d",
          transform: `translateZ(-${translateZDistance}vw)`,
        }}
      >
        {characters.slice(0, cardCount).map((character, index) => {
          // Calculate card position and visual properties
          const relativePosition = (index - currentCenterIndex + cardCount) % cardCount;
          const rotateY = relativePosition * angleStep;

          const isCentered = relativePosition === 0;
          const isBackface = rotateY > 90 && rotateY < 270;
          const isSideface = !isCentered && !isBackface;

          // Determine card appearance based on position
          let opacityClass, scale;
          if (isCentered) {
            opacityClass = "opacity-100";
            scale = 1;
          } else if (isSideface) {
            opacityClass = "opacity-70";
            scale = 0.9;
          } else {
            opacityClass = "opacity-40";
            scale = 0.8;
          }
          
          return (
            <div
              key={character.id}
              className={`absolute flex items-center justify-center max-w-[280px] max-h-[350px] w-[40vw] h-[50vw] left-[calc(50%-10vw)] top-[calc(50%-15vw)] rounded-[8px] ${opacityClass} ${
                isCentered
                  ? "shadow-[0_15px_35px_-18px_rgba(255,255,255,0.45)]"
                  : "shadow-[0_12px_28px_-20px_rgba(0,0,0,0.55)]"
              } transition-[transform,opacity,filter,box-shadow] duration-500 will-change-transform`}
              style={{
                transform: `rotateY(${rotateY}deg) translateZ(${translateZDistance}vw) scale(${scale})`,
                transformOrigin: "center center",
                transition: isAnimating
                  ? "transform 0.8s cubic-bezier(0.77, 0, 0.175, 1), opacity 0.3s ease, filter 0.3s ease, box-shadow 0.3s ease"
                  : "opacity 0.3s ease, filter 0.3s ease, box-shadow 0.3s ease",
              }}
            >
              {/* Character card content */}
              <div className="relative session-card h-full w-full transition-all duration-300 overflow-hidden rounded">
                {/* Action buttons */}
                <div className="absolute top-2 right-2 flex space-x-1 z-10">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e: React.MouseEvent) => {trackButtonClick("edit_character_btn", "编辑角色"); onEditClick(character, e);}}
                    className="h-auto w-auto p-1.5 bg-muted-surface hover:bg-muted-surface rounded-full text-primary-soft hover:text-highlight"
                    title={t("characterCardsPage.edit")}
                    aria-label={t("characterCardsPage.edit")}
                  >
                    <PencilLine className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e: React.MouseEvent) => {
                      trackButtonClick("delete_character_btn", "删除角色");
                      e.stopPropagation();
                      onDeleteClick(character.id);
                    }}
                    className="h-auto w-auto p-1.5 bg-muted-surface hover:bg-muted-surface rounded-full text-primary-soft hover:text-highlight"
                    title={t("characterCardsPage.delete")}
                    aria-label={t("characterCardsPage.delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
                        <UserRound className="h-24 w-24 text-ink" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  <div className="p-4 relative">
                    <h2 className="text-lg text-cream-soft line-clamp-1 magical-text">{character.name}</h2>
                    <div className={`text-xs text-ink-soft mt-2 italic ${fontClass}`}>
                      <span className="inline-block mr-1 opacity-70">✨</span>
                      <span className="line-clamp-2">{character.personality}</span>
                    </div>
                    {isCentered && cardCount > 1 && (
                      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-2 z-30">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); handleRotateLeft(); }}
                          disabled={isAnimating}
                          className="h-auto w-auto p-2 bg-muted-surface/90 hover:bg-muted-surface/95 rounded-full text-primary-soft hover:text-highlight backdrop-blur-sm border-muted-surface/50"
                          aria-label="向左旋转"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); handleRotateRight(); }}
                          disabled={isAnimating}
                          className="h-auto w-auto p-2 bg-muted-surface/90 hover:bg-muted-surface/95 rounded-full text-primary-soft hover:text-highlight backdrop-blur-sm border-muted-surface/50"
                          aria-label="向右旋转"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <style jsx>{`
        .transform-style-preserve-3d {
          transform-style: preserve-3d;
        }
      `}</style>
    </div>
  );
};

export default CharacterCardCarousel;
