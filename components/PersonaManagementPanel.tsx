/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    Persona Management Panel Component                      ║
 * ║                                                                            ║
 * ║  Persona 管理主界面                                                         ║
 * ║  支持创建、编辑、删除、设为默认等操作                                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState } from "react";
import { Plus, Star, Trash2, Edit2, Download, X } from "lucide-react";
import { useLanguage } from "@/app/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PersonaCard } from "@/components/PersonaCard";
import { PersonaEditor, type PersonaFormData } from "@/components/PersonaEditor";
import { usePersonas } from "@/hooks/usePersonas";
import type { Persona } from "@/lib/models/persona-model";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   类型定义
   ═══════════════════════════════════════════════════════════════════════════ */

interface PersonaManagementPanelProps {
  /** 是否打开 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 选择 Persona 后的回调 */
  onSelect?: (personaId: string) => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   组件实现
   ═══════════════════════════════════════════════════════════════════════════ */

export const PersonaManagementPanel: React.FC<PersonaManagementPanelProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const { language } = useLanguage();
  const {
    personas,
    defaultPersona,
    activePersona,
    createPersona,
    updatePersona,
    deletePersona,
    setAsDefault,
    activatePersona,
    exportAll,
  } = usePersonas();

  /* ─────────────────────────────────────────────────────────────────────────
     本地状态
     ───────────────────────────────────────────────────────────────────────── */
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Persona | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  /* ─────────────────────────────────────────────────────────────────────────
     事件处理
     ───────────────────────────────────────────────────────────────────────── */
  const handleCreate = () => {
    setEditingPersona(undefined);
    setIsEditorOpen(true);
  };

  const handleEdit = (persona: Persona) => {
    setEditingPersona(persona);
    setIsEditorOpen(true);
  };

  const handleSave = async (data: PersonaFormData) => {
    setIsSaving(true);
    try {
      if (editingPersona) {
        updatePersona(editingPersona.id, data);
      } else {
        const id = await createPersona({
          name: data.name,
          description: data.description,
          position: data.position,
          depth: data.depth,
          role: data.role,
        });
        // 如果有头像路径，单独更新
        if (data.avatarPath) {
          updatePersona(id, { avatarPath: data.avatarPath });
        }
      }
      setIsEditorOpen(false);
      setEditingPersona(undefined);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deletePersona(deleteTarget.id);
      if (selectedPersona?.id === deleteTarget.id) {
        setSelectedPersona(null);
      }
      setDeleteTarget(null);
    }
  };

  const handleSelect = (persona: Persona) => {
    setSelectedPersona(persona);
    activatePersona(persona.id);
    onSelect?.(persona.id);
  };

  const handleSetDefault = (persona: Persona) => {
    const isCurrentDefault = defaultPersona?.id === persona.id;
    setAsDefault(isCurrentDefault ? null : persona.id);
  };

  /* ─────────────────────────────────────────────────────────────────────────
     渲染
     ───────────────────────────────────────────────────────────────────────── */
  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {language === "zh" ? "Persona 管理" : "Persona Management"}
            </DialogTitle>
          </DialogHeader>

          {/* ─── 工具栏 ─── */}
          <div className="flex items-center justify-between py-2 border-b">
            <div className="text-sm text-muted-foreground">
              {language === "zh"
                ? `共 ${personas.length} 个 Persona`
                : `${personas.length} Persona(s)`
              }
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportAll}>
                <Download className="w-4 h-4 mr-2" />
                {language === "zh" ? "导出" : "Export"}
              </Button>
              <Button size="sm" onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                {language === "zh" ? "新建" : "New"}
              </Button>
            </div>
          </div>

          {/* ─── Persona 列表 ─── */}
          <div className="flex-1 overflow-y-auto py-4">
            {personas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <p className="mb-4">
                  {language === "zh"
                    ? "还没有创建任何 Persona"
                    : "No personas created yet"
                  }
                </p>
                <Button onClick={handleCreate}>
                  <Plus className="w-4 h-4 mr-2" />
                  {language === "zh" ? "创建第一个 Persona" : "Create your first persona"}
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {personas.map((persona) => (
                  <div
                    key={persona.id}
                    className="group relative"
                  >
                    <PersonaCard
                      persona={persona}
                      isSelected={selectedPersona?.id === persona.id}
                      isDefault={defaultPersona?.id === persona.id}
                      isActive={activePersona?.id === persona.id}
                      onClick={() => handleSelect(persona)}
                    />

                    {/* ─── 操作按钮（悬停显示） ─── */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetDefault(persona);
                        }}
                        title={
                          defaultPersona?.id === persona.id
                            ? (language === "zh" ? "取消默认" : "Unset default")
                            : (language === "zh" ? "设为默认" : "Set as default")
                        }
                      >
                        <Star
                          className={cn(
                            "w-4 h-4",
                            defaultPersona?.id === persona.id
                              ? "fill-yellow-500 text-yellow-500"
                              : "text-muted-foreground",
                          )}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(persona);
                        }}
                      >
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(persona);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── 编辑器对话框 ─── */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPersona
                ? (language === "zh" ? "编辑 Persona" : "Edit Persona")
                : (language === "zh" ? "创建 Persona" : "Create Persona")
              }
            </DialogTitle>
          </DialogHeader>
          <PersonaEditor
            persona={editingPersona}
            onSave={handleSave}
            onCancel={() => {
              setIsEditorOpen(false);
              setEditingPersona(undefined);
            }}
            isSaving={isSaving}
          />
        </DialogContent>
      </Dialog>

      {/* ─── 删除确认对话框 ─── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "zh" ? "确认删除" : "Confirm Delete"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "zh"
                ? `确定要删除 "${deleteTarget?.name}" 吗？此操作无法撤销。`
                : `Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === "zh" ? "取消" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {language === "zh" ? "删除" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PersonaManagementPanel;
