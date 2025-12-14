/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Persona Quick Switch Component                        ║
 * ║                                                                            ║
 * ║  侧边栏中的快速 Persona 切换组件                                             ║
 * ║  显示当前 Persona，点击展开选择列表                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState } from "react";
import Image from "next/image";
import { ChevronDown, User, Settings, Lock, Star } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PersonaCardCompact } from "@/components/PersonaCard";
import { PersonaManagementPanel } from "@/components/PersonaManagementPanel";
import { usePersonas } from "@/hooks/usePersonas";
import { useCurrentPersona } from "@/hooks/useCurrentPersona";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface PersonaQuickSwitchProps {
  /** 对话 Key */
  dialogueKey?: string;
  /** 角色 ID */
  characterId?: string;
  /** 是否折叠模式（仅显示头像） */
  isCollapsed?: boolean;
  /** 选择后是否自动锁定到 Chat */
  autoLock?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   组件实现
   ═══════════════════════════════════════════════════════════════════════════ */

export const PersonaQuickSwitch: React.FC<PersonaQuickSwitchProps> = ({
  dialogueKey,
  characterId,
  isCollapsed = false,
  autoLock = true,
}) => {
  const { language } = useLanguage();
  const { personas, defaultPersona, activatePersona, lockToChat } = usePersonas();
  const { persona: currentPersona, lockType, isTemporary } = useCurrentPersona(
    dialogueKey,
    characterId,
  );

  const [isOpen, setIsOpen] = useState(false);
  const [isManagementOpen, setIsManagementOpen] = useState(false);

  /* ─────────────────────────────────────────────────────────────────────────
     事件处理
     ───────────────────────────────────────────────────────────────────────── */
  const handleSelect = (personaId: string) => {
    activatePersona(personaId);

    // 自动锁定到当前 Chat
    if (autoLock && dialogueKey) {
      lockToChat(dialogueKey, personaId);
    }

    setIsOpen(false);
  };

  const handleOpenManagement = () => {
    setIsOpen(false);
    setIsManagementOpen(true);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     锁定状态显示
     ───────────────────────────────────────────────────────────────────────── */
  const getLockLabel = () => {
    switch (lockType) {
    case "chat":
      return language === "zh" ? "对话锁定" : "Chat locked";
    case "character":
      return language === "zh" ? "角色连接" : "Character linked";
    case "default":
      return language === "zh" ? "默认" : "Default";
    default:
      return "";
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────
     折叠模式渲染
     ───────────────────────────────────────────────────────────────────────── */
  if (isCollapsed) {
    return (
      <>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center",
                "hover:ring-2 hover:ring-primary/50 transition-all",
                isTemporary && "ring-2 ring-yellow-500/50",
              )}
            >
              {currentPersona?.avatarPath ? (
                <Image
                  src={currentPersona.avatarPath}
                  alt={currentPersona.name}
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              ) : (
                <User className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <PersonaList
              personas={personas}
              currentPersonaId={currentPersona?.id}
              defaultPersonaId={defaultPersona?.id}
              onSelect={handleSelect}
              onManage={handleOpenManagement}
              language={language}
            />
          </PopoverContent>
        </Popover>

        <PersonaManagementPanel
          isOpen={isManagementOpen}
          onClose={() => setIsManagementOpen(false)}
          onSelect={handleSelect}
        />
      </>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
     展开模式渲染
     ───────────────────────────────────────────────────────────────────────── */
  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "w-full flex items-center gap-3 p-2 rounded-lg",
              "bg-accent/50 hover:bg-accent transition-colors",
              isTemporary && "border border-yellow-500/50",
            )}
          >
            {/* ─── 头像 ─── */}
            <div className="w-9 h-9 rounded-full overflow-hidden bg-muted flex-shrink-0 relative">
              {currentPersona?.avatarPath ? (
                <Image
                  src={currentPersona.avatarPath}
                  alt={currentPersona.name}
                  fill
                  className="object-cover"
                  sizes="36px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* ─── 信息 ─── */}
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium truncate">
                  {currentPersona?.name || (language === "zh" ? "未选择" : "Not selected")}
                </span>
                {lockType !== "none" && (
                  <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                )}
              </div>
              {lockType !== "none" && (
                <span className="text-2xs text-muted-foreground">
                  {getLockLabel()}
                </span>
              )}
            </div>

            {/* ─── 展开指示 ─── */}
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-64 p-2" align="start">
          <PersonaList
            personas={personas}
            currentPersonaId={currentPersona?.id}
            defaultPersonaId={defaultPersona?.id}
            onSelect={handleSelect}
            onManage={handleOpenManagement}
            language={language}
          />
        </PopoverContent>
      </Popover>

      <PersonaManagementPanel
        isOpen={isManagementOpen}
        onClose={() => setIsManagementOpen(false)}
        onSelect={handleSelect}
      />
    </>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   Persona 列表子组件
   ═══════════════════════════════════════════════════════════════════════════ */

interface PersonaListProps {
  personas: ReturnType<typeof usePersonas>["personas"];
  currentPersonaId?: string;
  defaultPersonaId?: string;
  onSelect: (id: string) => void;
  onManage: () => void;
  language: string;
}

const PersonaList: React.FC<PersonaListProps> = ({
  personas,
  currentPersonaId,
  defaultPersonaId,
  onSelect,
  onManage,
  language,
}) => {
  return (
    <div className="space-y-1">
      {/* ─── 标题 ─── */}
      <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase">
        {language === "zh" ? "切换 Persona" : "Switch Persona"}
      </div>

      {/* ─── Persona 列表 ─── */}
      {personas.length === 0 ? (
        <div className="px-2 py-4 text-sm text-center text-muted-foreground">
          {language === "zh" ? "暂无 Persona" : "No personas"}
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          {personas.map((persona) => (
            <PersonaCardCompact
              key={persona.id}
              persona={persona}
              isSelected={persona.id === currentPersonaId}
              isDefault={persona.id === defaultPersonaId}
              onClick={() => onSelect(persona.id)}
            />
          ))}
        </div>
      )}

      {/* ─── 分隔线 ─── */}
      <div className="my-1 border-t" />

      {/* ─── 管理按钮 ─── */}
      <button
        onClick={onManage}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
      >
        <Settings className="w-4 h-4" />
        {language === "zh" ? "管理 Personas" : "Manage Personas"}
      </button>
    </div>
  );
};

export default PersonaQuickSwitch;
