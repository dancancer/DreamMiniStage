/**
 * @input  react, next/navigation, lucide-react, components/ui/*, components/*, function/character/*, utils/*, lib/store/*, lib/storage/*, app/i18n
 * @output CharacterCards (default export)
 * @pos    页面组件 - 角色卡管理页面，支持浏览和创建会话两种模式
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      Character Cards Page                                 ║
 * ║                                                                           ║
 * ║  角色卡管理页面 - 支持浏览和创建会话两种模式                                   ║
 * ║  mode=create-session 时，点击角色卡创建会话并跳转                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Aperture, LayoutGrid, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StageEmptyState } from "@/components/ui/stage-empty-state";
import { useLanguage } from "@/app/i18n";
import ImportCharacterModal from "@/components/ImportCharacterModal";
import EditCharacterModal from "@/components/EditCharacterModal";
import CharacterCardGrid from "@/components/CharacterCardGrid";
import CharacterCardCarousel from "@/components/CharacterCardCarousel";
import { getAllCharacters } from "@/function/character/list";
import { deleteCharacter } from "@/function/character/delete";
import { trackButtonClick } from "@/utils/google-analytics";
import { moveToTop } from "@/function/character/move-to-top";
import { toast } from "@/lib/store/toast-store";
import { useSessionStore } from "@/lib/store/session-store";
import { getString, setString } from "@/lib/storage/client-storage";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/**
 * Interface defining the structure of a character object
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

/**
 * 角色卡页面主组件
 *
 * 支持两种模式：
 * 1. 默认模式：浏览角色卡，点击直接进入聊天
 * 2. 创建会话模式（mode=create-session）：点击角色卡创建新会话
 */
function CharacterCardsContent() {
  const { t, fontClass, language } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ========== 模式判断 ==========
  const isCreateSessionMode = searchParams.get("mode") === "create-session";

  // ========== Session Store ==========
  const { createSession } = useSessionStore();

  // ========== 本地状态 ==========
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "carousel">("grid");
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const savedViewMode = getString("characterCardsViewMode");
    if (savedViewMode === "grid" || savedViewMode === "carousel") {
      setViewMode(savedViewMode);
    }
  }, []);

  useEffect(() => {
    setMounted(true);

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const fetchCharacters = useCallback(async () => {
    setIsLoading(true);
    const username = getString("username");
    const language = getString("language", "zh");
    try {
      const response = await getAllCharacters(language as "zh" | "en", username);

      if (!response) {
        setCharacters([]);
        return;
      }

      setCharacters(response);
    } catch (err) {
      console.error("Error fetching characters:", err);
      toast.error(t("characterCardsPage.fetchError") || "Failed to fetch characters");
      setCharacters([]);
    } finally {
      setIsLoading(false);
    }
  }, [t]);
    
  const handleDeleteCharacter = async (characterId: string) => {
    setIsLoading(true);
    try {
      const response = await deleteCharacter(characterId);

      if (!response.success) {
        throw new Error(t("characterCardsPage.deleteFailed"));
      }

      fetchCharacters();
    } catch (err) {
      console.error("Error deleting character:", err);
      toast.error(t("characterCardsPage.deleteFailed") || "Failed to delete character");
      setIsLoading(false);
    }
  };

  const handleMoveCharToTop = async (characterId: string) => {
    setIsLoading(true);
    try {
      const response = await moveToTop(characterId);

      if (!response.success) {
        throw new Error(t("characterCardsPage.topFailed"));
      }

      fetchCharacters();
    } catch (err) {
      console.error("Error moving character to top:", err);
      toast.error(t("characterCardsPage.topFailed") || "Failed to move character to top");
      setIsLoading(false);
    }
  };

  const handleEditClick = (character: Character, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentCharacter(character);
    setIsEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    fetchCharacters();
    setIsEditModalOpen(false);
    setCurrentCharacter(null);
  };

  /**
   * 处理角色卡点击 - 创建会话模式
   * Requirements: 3.3
   */
  const handleCharacterSelect = useCallback(
    async (characterId: string) => {
      if (!isCreateSessionMode || isCreatingSession) return;

      setIsCreatingSession(true);
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
        setIsCreatingSession(false);
      }
    },
    [isCreateSessionMode, isCreatingSession, createSession, router, t],
  );

  useEffect(() => {
    const initializeData = async () => {
      await fetchCharacters();
    };
    
    initializeData();
  }, [fetchCharacters]);

  if (!mounted) return null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <main className="h-full w-full overflow-y-auto" aria-labelledby="character-cards-heading">
        <div className="flex flex-col items-center justify-start w-full py-8">
          <div className="w-full max-w-4xl relative z-10 px-4">
            <header className="mb-8 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <h1 id="character-cards-heading" className={"text-xl sm:text-2xl magical-login-text "}>{t("sidebar.characterCards")}</h1>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={`hidden h-11 w-11 md:flex ${fontClass}`}
                  aria-label={viewMode === "grid" ? "切换到轮播视图" : "切换到网格视图"}
                  onClick={() => {
                    trackButtonClick("view_mode_btn", "切换视图模式");
                    const newViewMode = viewMode === "grid" ? "carousel" : "grid";
                    setViewMode(newViewMode);
                    setString("characterCardsViewMode", newViewMode);
                  }}
                >
                  {viewMode === "grid" ? (
                    <LayoutGrid className="h-4 w-4" />
                  ) : (
                    <Aperture className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex gap-2 sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`${fontClass} h-11 px-4 sm:h-10`}
                  onClick={() => setIsImportModalOpen(true)}
                >
                  {t("characterCardsPage.importCharacter")}
                </Button>
              </div>
            </header>

            {isLoading ? (
              <div className="flex justify-center items-center h-64 animate-in fade-in duration-300">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-2 border-t-primary-bright border-r-primary-soft border-b-ink-soft border-l-transparent animate-spin"></div>
                  <div className="absolute inset-2 rounded-full border-2 border-t-ink-soft border-r-primary-bright border-b-primary-soft border-l-transparent animate-spin-slow"></div>
                  <div className={`absolute w-full text-center top-20 text-primary-soft ${fontClass}`}>
                    {t("characterCardsPage.loading")}
                  </div>
                </div>
              </div>
            ) : characters.length === 0 ? (
              <StageEmptyState
                icon={<Star size={36} fill="currentColor" fillOpacity={0.18} />}
                eyebrow={language === "zh" ? "角色库" : "Character Library"}
                title={t("characterCardsPage.noCharacters")}
                description={language === "zh"
                  ? "先导入角色卡，再从角色开始新的叙事会话。"
                  : "Import a character card first, then begin a new storytelling session from that role."}
                note={language === "zh"
                  ? "角色是舞台的入口。先把角色带进来，世界和会话才会真正开始运转。"
                  : "Characters are the doorway into the stage. Once they arrive, the world and the session can actually start moving."}
                primaryAction={{ label: t("characterCardsPage.importFirstCharacter"), onClick: () => setIsImportModalOpen(true) }}
                className="animate-in fade-in slide-in-from-bottom-2 duration-300"
              />
            ) : viewMode === "grid" || isMobile || prefersReducedMotion ? (
              <CharacterCardGrid
                characters={characters}
                onEditClick={handleEditClick}
                onDeleteClick={handleDeleteCharacter}
                onMoveToTopClick={handleMoveCharToTop}
                onCharacterSelect={isCreateSessionMode ? handleCharacterSelect : undefined}
                isCreateSessionMode={isCreateSessionMode}
                isCreatingSession={isCreatingSession}
              />
            ) : (
              <CharacterCardCarousel
                characters={characters}
                onEditClick={handleEditClick}
                onDeleteClick={handleDeleteCharacter}
                onCharacterSelect={isCreateSessionMode ? handleCharacterSelect : undefined}
                isCreateSessionMode={isCreateSessionMode}
                isCreatingSession={isCreatingSession}
              />
            )}
          </div>

          <ImportCharacterModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onImport={fetchCharacters}
          />
          {currentCharacter && (
            <EditCharacterModal
              isOpen={isEditModalOpen}
              onClose={() => setIsEditModalOpen(false)}
              characterId={currentCharacter.id}
              characterData={{
                name: currentCharacter.name,
                personality: currentCharacter.personality,
                scenario: currentCharacter.scenario,
                first_mes: currentCharacter.first_mes,
                creatorcomment: currentCharacter.creatorcomment,
                avatar_path: currentCharacter.avatar_path,
              }}
              onSave={handleEditSuccess}
            />
          )}

        </div>
      </main>
    </div>
  );
}

/**
 * Suspense 包装组件
 */
export default function CharacterCards() {
  const { t } = useLanguage();

  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-64 animate-in fade-in duration-300">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-t-primary-bright border-r-primary-soft border-b-ink-soft border-l-transparent animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-2 border-t-ink-soft border-r-primary-bright border-b-primary-soft border-l-transparent animate-spin-slow"></div>
            <div className="absolute w-full text-center top-20 text-primary-soft">
              {t("characterCardsPage.loading")}
            </div>
          </div>
        </div>
      }
    >
      <CharacterCardsContent />
    </Suspense>
  );
}
