/**
 * Edit Character Modal Component
 * 
 * This component provides a comprehensive character editing interface with the following features:
 * - Character information editing (name, personality, scenario, etc.)
 * - Avatar display and character preview
 * - Form validation and error handling
 * - Real-time character updates
 * - Modal-based editing workflow
 * - Responsive design with animations
 * 
 * The component handles:
 * - Character data editing and validation
 * - Character updates and persistence
 * - Modal state management and animations
 * - Error handling and user feedback
 * - Form state management and cleanup
 * - Avatar display and character preview
 * 
 * Dependencies:
 * - useLanguage: For internationalization
 * - updateCharacter: For character update functionality
 * - trackButtonClick: For analytics tracking
 * - CharacterAvatarBackground: For avatar display
 */

import React, { useState, useEffect, useCallback } from "react";
import { UserRound } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { trackButtonClick } from "@/utils/google-analytics";
import { updateCharacter } from "@/function/dialogue/update";
import { CharacterAvatarBackground } from "@/components/CharacterAvatarBackground";
import { toast } from "@/lib/store/toast-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Interface definitions for the component's props
 */
interface EditCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterId: string;
  characterData: {
    name: string;
    personality?: string;
    scenario?: string;
    first_mes?: string;
    creatorcomment?: string;
    avatar_path?: string;
  };
  onSave: () => void;
}

/**
 * Edit character modal component
 * 
 * Provides a comprehensive character editing interface with:
 * - Character information editing
 * - Avatar display and preview
 * - Form validation and error handling
 * - Real-time updates and persistence
 * - Modal-based workflow management
 * 
 * @param {EditCharacterModalProps} props - Component props
 * @returns {JSX.Element | null} The edit character modal or null if closed
 */
const EditCharacterModal: React.FC<EditCharacterModalProps> = ({
  isOpen,
  onClose,
  characterId,
  characterData,
  onSave,
}) => {
  const { t, fontClass, serifFontClass } = useLanguage();
  const [name, setName] = useState("");
  const [personality, setPersonality] = useState("");
  const [scenario, setScenario] = useState("");
  const [firstMessage, setFirstMessage] = useState(""); 
  const [creatorComment, setCreatorComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && characterData) {
      setName(characterData.name || "");
      setPersonality(characterData.personality || "");
      setScenario(characterData.scenario || "");
      setFirstMessage(characterData.first_mes || "");
      setCreatorComment(characterData.creatorcomment || "");
    }
  }, [isOpen, characterData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await updateCharacter(characterId, {
        name,
        personality,
        scenario,
        first_mes: firstMessage,
        creatorcomment: creatorComment,
      });

      if (!response.success) {
        throw new Error("Failed to update character");
      }

      onSave();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      trackButtonClick("EditCharacterModal", "关闭编辑角色");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden  border-border gap-0">
        
        <div className="flex flex-col md:flex-row h-full max-h-[85vh]">
          <div className="md:w-2/5 lg:w-1/3 relative bg-muted-surface/30">
            <div className="h-full min-h-[300px] relative">
              {characterData.avatar_path ? (
                <CharacterAvatarBackground avatarPath={characterData.avatar_path} />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted-surface">
                  <UserRound className="h-32 w-32 text-ink" strokeWidth={1.5} />
                </div>
              )}
              <div className={"absolute bottom-4 w-full text-center text-cream-soft  text-xl magical-text z-10"}>
                {name || characterData.name}
              </div>
            </div>
          </div>
          
          <div className="md:w-3/5 lg:w-2/3  p-6 flex flex-col h-full overflow-hidden">
            <DialogHeader className="mb-6 flex-shrink-0">
              <DialogTitle className={"text-xl font-semibold text-cream-soft magical-text "}>
                {t("editCharacterModal.title")}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-5 fantasy-scrollbar">
              <div>
                <label
                  htmlFor="character-name"
                  className={`block text-sm font-medium text-primary-soft mb-2 ${fontClass}`}
                >
                  {t("editCharacterModal.name")}
                </label>
                <input
                  type="text"
                  id="character-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full bg-muted-surface border border-border rounded p-3 text-cream-soft focus:outline-none focus:ring-1 focus:ring-primary-soft ${fontClass} fantasy-input`}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="character-personality"
                  className={`block text-sm font-medium text-primary-soft mb-2 ${fontClass}`}
                >
                  {t("editCharacterModal.personality")}
                </label>
                <textarea
                  id="character-personality"
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  rows={3}
                  className={`w-full bg-muted-surface border border-border rounded p-3 text-cream-soft focus:outline-none focus:ring-1 focus:ring-primary-soft ${fontClass} fantasy-input`}
                />
              </div>
          
              <div>
                <label
                  htmlFor="character-scenario"
                  className={`block text-sm font-medium text-primary-soft mb-2 ${fontClass}`}
                >
                  {t("editCharacterModal.scenario")}
                </label>
                <textarea
                  id="character-scenario"
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  rows={3}
                  className={`w-full bg-muted-surface border border-border rounded p-3 text-cream-soft focus:outline-none focus:ring-1 focus:ring-primary-soft ${fontClass} fantasy-input`}
                />
              </div>
          
              <div>
                <label
                  htmlFor="character-first-message"
                  className={`block text-sm font-medium text-primary-soft mb-2 ${fontClass}`}
                >
                  {t("editCharacterModal.firstMessage")}
                </label>
                <textarea
                  id="character-first-message"
                  value={firstMessage}
                  onChange={(e) => setFirstMessage(e.target.value)}
                  rows={3}
                  className={`w-full bg-muted-surface border border-border rounded p-3 text-cream-soft focus:outline-none focus:ring-1 focus:ring-primary-soft ${fontClass} fantasy-input`}
                />
              </div>
          
              <div>
                <label
                  htmlFor="character-creator-comment"
                  className={`block text-sm font-medium text-primary-soft mb-2 ${fontClass}`}
                >
                  {t("editCharacterModal.creatorComment")}
                </label>
                <textarea
                  id="character-creator-comment"
                  value={creatorComment}
                  onChange={(e) => setCreatorComment(e.target.value)}
                  rows={3}
                  className={`w-full bg-muted-surface border border-border rounded p-3 text-cream-soft focus:outline-none focus:ring-1 focus:ring-primary-soft ${fontClass} fantasy-input`}
                />
              </div>

              <div className="flex justify-end space-x-4 pt-4 pb-2 mt-auto">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={(e) => {trackButtonClick("EditCharacterModal", "关闭编辑角色");onClose();}}
                  className="text-text-muted hover:text-cream"
                >
                  {t("editCharacterModal.cancel")}
                </Button>
                <Button
                  type="submit"
                  variant="ghost"
                  disabled={isLoading}
                  onClick={(e) => {trackButtonClick("EditCharacterModal", "保存编辑角色");}}
                  className="text-primary-400 hover:text-primary-300"
                >
                  {isLoading ? (
                    <div className="h-5 w-5 border-2 border-deep border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    t("editCharacterModal.save")
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditCharacterModal;
