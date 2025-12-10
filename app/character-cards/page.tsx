/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                      Character Cards Page                                 ║
 * ║                                                                           ║
 * ║  角色卡管理页面 - 支持浏览和创建会话两种模式                                   ║
 * ║  mode=create-session 时，点击角色卡创建会话并跳转                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Aperture, LayoutGrid, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/app/i18n";
import ImportCharacterModal from "@/components/ImportCharacterModal";
import EditCharacterModal from "@/components/EditCharacterModal";
import CharacterCardGrid from "@/components/CharacterCardGrid";
import CharacterCardCarousel from "@/components/CharacterCardCarousel";
import { getAllCharacters } from "@/function/character/list";
import { deleteCharacter } from "@/function/character/delete";
import { handleCharacterUpload } from "@/function/character/import";
import { trackButtonClick } from "@/utils/google-analytics";
import { moveToTop } from "@/function/character/move-to-top";
import { toast } from "@/lib/store/toast-store";
import { useSessionStore } from "@/lib/store/session-store";
import { getBoolean, getString, setBoolean, setString } from "@/lib/storage/client-storage";

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
export default function CharacterCards() {
  const { t, fontClass } = useLanguage();
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
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isDownloadingPresets, setIsDownloadingPresets] = useState(false);
  const [hasAttemptedPresetDownload, setHasAttemptedPresetDownload] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

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
    
    const yellowImg = new Image();
    const redImg = new Image();
    
    yellowImg.src = "/background_yellow.png";
    redImg.src = "/background_red.png";
    
    Promise.all([
      new Promise(resolve => yellowImg.onload = resolve),
      new Promise(resolve => redImg.onload = resolve),
    ]).then(() => {
      setImagesLoaded(true);
    });
    
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
    
  /**
   * Migrates data structure by deleting all character cards
   * This is a one-time operation triggered by localStorage flag
   * Used when data structure changes from parsed_content to parsedContent
   */
  const migrateDataStructure = useCallback(async () => {
    const migrationFlag = getString("characterCardsDataMigration");
    const migrationConfirmed = getBoolean("characterCardsDataMigrationConfirmed");
    
    // Check if migration is needed and hasn't been performed yet
    if (migrationFlag !== "completed" && migrationConfirmed) {
      console.log("Starting data structure migration - deleting all character cards");
      
      try {
        // Fetch all characters first
        const username = getString("username");
        const language = getString("language", "zh");
        const characters = await getAllCharacters(language as "zh" | "en", username);
        
        if (characters && characters.length > 0) {
          // Delete all character cards
          for (const character of characters) {
            try {
              await deleteCharacter(character.id);
              console.log(`Deleted character: ${character.name}`);
            } catch (error) {
              console.error(`Failed to delete character ${character.name}:`, error);
              toast.error(`Failed to delete character ${character.name}`);
            }
          }
        }
        
        // Mark migration as completed
        setString("characterCardsDataMigration", "completed");
        console.log("Data structure migration completed");
        
      } catch (error) {
        console.error("Error during data structure migration:", error);
        toast.error(t("characterCardsPage.migrationError") || "Error during data migration");
      }
    } else if (migrationFlag !== "completed" && !migrationConfirmed) {
      console.warn("Skipped destructive character card migration because confirmation flag is missing. Set 'characterCardsDataMigrationConfirmed' in localStorage to proceed after manual backup.");
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

  /**
   * Downloads preset character cards for first-time users or when character list is empty
   * Fetches available characters from GitHub and downloads specific preset characters
   */
  const downloadPresetCharacters = useCallback(async () => {
    setHasAttemptedPresetDownload(true);
    setIsDownloadingPresets(true);
    try {
      // Fetch available character files from GitHub
      const response = await fetch("https://api.github.com/repos/DreamMiniStage/Character-Card/contents");
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.error("Failed to fetch character files from GitHub");
        toast.error(t("characterCardsPage.downloadError") || "Failed to fetch preset characters");
        return;
      }

      // Define specific preset character files to download
      const presetCharacterNames = [
        "《致炽焰以战歌》(二次元)(同人、二创).png",
        "为美好的世界献上祝福恋爱角色扮演--纯爱，同人二创(同人、二创).png",
        "在地下城寻求邂逅是否搞错了什么（拓展神明扮演）--纯爱，系统工具(玄幻、同人、二创).png",
      ];

      // Filter and find the specific preset characters
      const pngFiles = data.filter((item: any) => 
        item.name.endsWith(".png") && presetCharacterNames.includes(item.name),
      );

      // Download and import each preset character
      for (const file of pngFiles) {
        try {
          const fileResponse = await fetch(file.download_url || `https://raw.githubusercontent.com/DreamMiniStage/Character-Card/main/${file.name}`);
          if (!fileResponse.ok) {
            console.error(`Failed to download ${file.name}`);
            toast.error(`Failed to download ${file.name}`);
            continue;
          }
          
          const blob = await fileResponse.blob();
          const fileObj = new File([blob], file.name, { type: blob.type });
          
          await handleCharacterUpload(fileObj);
        } catch (error) {
          console.error(`Failed to import ${file.name}:`, error);
        }
      }

      // Refresh character list after importing
      await fetchCharacters();
      
      // Only mark as not first time if it was actually the first visit
      const isFirstVisit = !getBoolean("characterCardsFirstVisit", false);
      if (isFirstVisit) {
        setBoolean("characterCardsFirstVisit", false);
      }
      
    } catch (error) {
      console.error("Error downloading preset characters:", error);
    } finally {
      setIsDownloadingPresets(false);
    }
  }, [fetchCharacters, t]);

  useEffect(() => {
    const initializeData = async () => {
      // First run data structure migration if needed
      await migrateDataStructure();
      // Then fetch characters
      await fetchCharacters();
    };
    
    initializeData();
  }, [fetchCharacters, migrateDataStructure]);

  // Check if this is the first visit and auto-download preset characters
  useEffect(() => {
    const isFirstVisit = !getBoolean("characterCardsFirstVisit", false);
    
    // Auto-download preset characters if:
    // 1. It's the first visit, OR
    // 2. Character list is empty (regardless of first visit status)
    if (
      !hasAttemptedPresetDownload &&
      (isFirstVisit || characters.length === 0) &&
      characters.length === 0 &&
      !isLoading &&
      !isDownloadingPresets
    ) {
      downloadPresetCharacters();
    }
  }, [characters.length, downloadPresetCharacters, hasAttemptedPresetDownload, isDownloadingPresets, isLoading]);

  if (!mounted) return null;

  return (
    <div className="h-full w-full overflow-hidden  relative">
      <div
        className={`absolute inset-0 z-0 opacity-35 transition-opacity duration-500  ${
          imagesLoaded ? "opacity-35" : "opacity-0"
        }`}
      />

      <div
        className={`absolute inset-0 z-1 opacity-45 transition-opacity duration-500  mix-blend-multiply ${
          imagesLoaded ? "opacity-45" : "opacity-0"
        }`}
      />
      
      <div className="h-full w-full overflow-y-auto">
        <div className="flex flex-col items-center justify-start w-full py-8">
          <div className="w-full max-w-4xl relative z-10 px-4">
            <div className="flex justify-between items-center mb-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-3">
                <h1 className={"text-xl sm:text-2xl magical-login-text "}>{t("sidebar.characterCards")}</h1>
                <Button
                  variant="outline"
                  size="icon"
                  className={`hidden md:flex ${fontClass}`}
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
                  variant="outline"
                  size="sm"
                  className={fontClass}
                  onClick={() => setIsImportModalOpen(true)}
                >
                  {t("characterCardsPage.importCharacter")}
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center h-64 animate-in fade-in duration-300">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-2 border-t-primary-bright border-r-primary-soft border-b-ink-soft border-l-transparent animate-spin"></div>
                  <div className="absolute inset-2 rounded-full border-2 border-t-ink-soft border-r-primary-bright border-b-primary-soft border-l-transparent animate-spin-slow"></div>
                  <div className={`absolute w-full text-center top-20 text-primary-soft ${fontClass}`}>
                    {isDownloadingPresets ? t("characterCardsPage.downloadingPresets") : t("characterCardsPage.loading")}
                  </div>
                </div>
              </div>
            ) : characters.length === 0 ? (
              <div className="session-card p-8 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="mb-6 opacity-60 text-primary-bright">
                  <Star size={64} fill="currentColor" fillOpacity={0.3} className="mx-auto" />
                </div>
                <p className={"text-cream-soft mb-6 "}>{t("characterCardsPage.noCharacters")}</p>
                <div
                  className={`portal-button inline-block text-primary-soft hover:text-highlight px-5 py-2 border border-border rounded-md cursor-pointer ${fontClass} transition-transform duration-150 hover:scale-105 active:scale-95`}
                  onClick={() => setIsImportModalOpen(true)}
                >
                  {t("characterCardsPage.importFirstCharacter")}
                </div>
              </div>
            ) : viewMode === "grid" || isMobile ? (
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
      </div>
    </div>
  );
}
