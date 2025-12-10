/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       DialogueTreeModal                                   ║
 * ║  对话树可视化弹窗：ELK 布局 + 增量刷新 + 节点编辑                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  ConnectionLineType,
  Edge,
  MiniMap,
  Node,
  NodeTypes,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/app/i18n";
import { trackButtonClick } from "@/utils/google-analytics";
import { switchDialogueBranch } from "@/function/dialogue/truncate";
import { editDialaogueNodeContent } from "@/function/dialogue/edit";
import { DialogueFlowStyles, DialogueNodeComponent } from "@/components/dialogue-tree";
import { DialogueEditModal } from "@/components/dialogue-tree/DialogueEditModal";
import { DialoguePlaceholderCard } from "@/components/dialogue-tree/DialoguePlaceholderCard";
import { useDialogueLayout } from "@/hooks/useDialogueLayout";
import { DialogueNode, useDialogueTreeData } from "@/hooks/useDialogueTreeData";
import { useDialoguePreferences } from "@/hooks/character-dialogue/useDialoguePreferences";
import type { DialogueNodeData } from "@/components/dialogue-tree/DialogueNodeComponent";

interface DialogueTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterId?: string;
  sessionId?: string;  // 会话 ID（可选，用于按会话加载对话树）
  onDialogueEdit?: () => void;
}

const nodeTypes: NodeTypes = { dialogueNode: DialogueNodeComponent };
function applyPathStyles(edges: Edge[], pathSet: Set<string>) {
  return edges.map((edge) => {
    const isRoot = edge.source === "root";
    const isCurrent = pathSet.has(edge.source) && pathSet.has(edge.target);
    const palette = isRoot
      ? { stroke: "var(--color-info)", className: "root-source", width: 3 }
      : isCurrent
        ? { stroke: "var(--color-danger)", className: "current-path", width: 3 }
        : { stroke: "var(--color-ink-soft)", className: "other-path", width: 2 };
    return {
      ...edge,
      className: palette.className,
      style: { ...edge.style, stroke: palette.stroke, strokeWidth: palette.width },
      labelBgStyle: { ...edge.labelBgStyle, fill: "var(--color-deep)" },
    };
  });
}

export default function DialogueTreeModal({ isOpen, onClose, characterId, sessionId, onDialogueEdit }: DialogueTreeModalProps) {
  // 使用 sessionId 或回退到 characterId 作为对话树索引
  const dialogueKey = sessionId || characterId;
  const { t, fontClass, serifFontClass } = useLanguage();
  const [nodes, setNodes, onNodesChange] = useNodesState<DialogueNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<DialogueNode | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const nodesRef = useRef<DialogueNode[]>([]);
  const editModalRef = useRef<HTMLDivElement>(null);
  const { language, readLlmConfig } = useDialoguePreferences();

  const {
    layoutMethod,
    userAdjustedPositions,
    calculateProgressiveLayout,
    applyLayout,
    resetUserPositions,
    saveNodePosition,
    setUserAdjustedPositions,
  } = useDialogueLayout();

  async function handleJumpToNode(id: string) {
    if (!dialogueKey) return;
    setIsRefreshing(true);
    try {
      trackButtonClick("DialogueTreeModal", "jump_to_node");
      await switchDialogueBranch({ dialogueId: dialogueKey, nodeId: id });
      await loadDialogue(dataLoaded ? "incremental" : "full");
    } catch (error) {
      console.error("Jump to node failed", error);
    } finally {
      setIsRefreshing(false);
    }
  }

  const handleEditNode = useCallback((id: string) => {
    const target = nodesRef.current.find((node) => node.id === id);
    if (!target) return;
    setSelectedNode(target);
    setEditContent(target.data.assistantResponse || "");
    setIsEditModalOpen(true);
  }, []);

  const {
    dataLoaded,
    fetchDialogueData,
    fetchIncrementalData,
    updateCurrentPath,
    setDataLoaded,
  } = useDialogueTreeData({
    characterId: characterId ?? null,
    dialogueKey: dialogueKey ?? null,
    onEditClick: handleEditNode,
    onJumpClick: (id: string) => handleJumpToNode(id),
    t,
  });

  const defaultEdgeOptions = useMemo(
    () => ({
      type: "smoothstep",
      style: { stroke: "var(--color-ink-soft)", strokeWidth: 2 },
      animated: false,
    }),
    [],
  );

  const pruneUserPositions = useCallback(
    (nextNodes: DialogueNode[]) => {
      setUserAdjustedPositions((prev) => {
        const result: Record<string, { x: number; y: number }> = {};
        nextNodes.forEach((node) => {
          if (prev[node.id]) result[node.id] = prev[node.id];
        });
        return result;
      });
    },
    [setUserAdjustedPositions],
  );

  // ═══════════════════════════════════════════════════════════════
  // 节点布局计算与应用
  // ───────────────────────────────────────────────────────────────
  // 移除 setNodes/setEdges 依赖，它们的引用在 reactflow 中不稳定
  // 使用 useCallback 确保函数引用稳定，避免触发上层 Effect
  // ═══════════════════════════════════════════════════════════════
  const placeNodes = useCallback(
    async (incomingNodes: DialogueNode[], incomingEdges: Edge[], preferProgressive: boolean) => {
      if (incomingNodes.length === 0) {
        setNodes([]);
        setEdges([]);
        nodesRef.current = [];
        return;
      }
      const layouted =
        preferProgressive && nodesRef.current.length > 0
          ? await calculateProgressiveLayout(incomingNodes, incomingEdges, nodesRef.current)
          : await applyLayout(incomingNodes, incomingEdges);
      pruneUserPositions(layouted);
      nodesRef.current = layouted;
      setNodes(layouted);
      setEdges(incomingEdges);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyLayout, calculateProgressiveLayout, pruneUserPositions],
  );

  const loadDialogue = useCallback(
    async (mode: "full" | "incremental" = "full") => {
      if (!characterId) return;
      setIsRefreshing(true);
      const fetcher = mode === "incremental" ? fetchIncrementalData : fetchDialogueData;
      const result = await fetcher();
      if (!result) {
        setIsRefreshing(false);
        setDataLoaded(true);
        return;
      }
      await placeNodes(result.nodes, result.edges, mode === "incremental");
      setIsRefreshing(false);
      setDataLoaded(true);
    },
    [characterId, fetchDialogueData, fetchIncrementalData, placeNodes, setDataLoaded],
  );

  const handleResetLayout = useCallback(async () => {
    if (nodesRef.current.length === 0) return;
    resetUserPositions();
    await placeNodes(nodesRef.current, edges, false);
  }, [edges, placeNodes, resetUserPositions]);

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      saveNodePosition(node.id, node.position.x, node.position.y);
      nodesRef.current = nodesRef.current.map((item) =>
        item.id === node.id ? { ...item, position: node.position } : item,
      );
    },
    [saveNodePosition],
  );

  const handleHighlightPath = useCallback(async () => {
    const pathInfo = await updateCurrentPath();
    if (!pathInfo?.currentPathIds) return;
    const pathSet = new Set(pathInfo.currentPathIds);
    setNodes((prev) =>
      prev.map((node) => ({
        ...node,
        data: { ...node.data, isCurrentPath: pathSet.has(node.id) },
      })),
    );
    setEdges((prev) => applyPathStyles(prev, pathSet));
  }, [setEdges, setNodes, updateCurrentPath]);

  const saveEditContent = useCallback(async () => {
    if (!selectedNode || !dialogueKey || !characterId) {
      setIsEditModalOpen(false);
      return;
    }
    setIsSaving(true);
    try {
      const { llmType, modelName, baseUrl, apiKey } = readLlmConfig();

      const response = await editDialaogueNodeContent({
        dialogueId: dialogueKey,
        characterId,
        nodeId: selectedNode.id,
        assistantResponse: editContent,
        model_name: modelName,
        api_key: apiKey,
        base_url: baseUrl,
        llm_type: llmType,
        language,
      });

      if (!response.success) throw new Error("Failed to update node content");

      setNodes((prev) => {
        const updated = prev.map((node) =>
          node.id === selectedNode.id
            ? {
              ...node,
              data: {
                ...node.data,
                assistantResponse: editContent,
                parsedContent: { compressedContent: response.summary },
              },
            }
            : node,
        );
        nodesRef.current = updated;
        return updated;
      });
      setIsEditModalOpen(false);
      onDialogueEdit?.();
    } catch (error) {
      console.error("Error saving edited content:", error);
    } finally {
      setIsSaving(false);
    }
  }, [dialogueKey, characterId, editContent, language, onDialogueEdit, readLlmConfig, selectedNode, setNodes]);

  // ═══════════════════════════════════════════════════════════════
  // 对话框打开时加载数据
  // ───────────────────────────────────────────────────────────────
  // 只依赖 isOpen 和 characterId，避免 setter 函数引起的循环
  // loadDialogue 内部已经包含了所有必要的状态更新逻辑
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (isOpen && characterId) {
      loadDialogue("full");
    } else {
      setDataLoaded(false);
      setNodes([]);
      setEdges([]);
      nodesRef.current = [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, isOpen]);

  if (!isOpen) return null;

  const manualCount = Object.keys(userAdjustedPositions).length;
  const showEmpty = dataLoaded && nodes.length === 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <DialogueFlowStyles />
      <div className="absolute inset-0 backdrop-blur-sm"></div>
      <div className=" bg-opacity-75 border border-border rounded-md  p-4 w-[90%] h-[80%] max-w-5xl mx-4  relative z-10 backdrop-filter backdrop-blur-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className={"text-cream text-lg "}>{t("dialogue.treeVisualization")}</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              trackButtonClick("DialogueTreeModal", "close_modal");
              onClose();
            }}
          >
            <X size={20} />
          </Button>
        </div>

        {!characterId ? (
          <DialoguePlaceholderCard
            title={t("dialogue.noCharacterSelected")}
            description={t("dialogue.selectCharacterFirst")}
            actionText={t("common.return")}
            onAction={() => {
              trackButtonClick("DialogueTreeModal", "close_no_character");
              onClose();
            }}
            fontClass={fontClass}
            serifFontClass={serifFontClass}
          />
        ) : !dataLoaded ? (
          <DialoguePlaceholderCard
            title={t("dialogue.loadingDialogue")}
            description=""
            fontClass={fontClass}
            serifFontClass={serifFontClass}
          />
        ) : showEmpty ? (
          <DialoguePlaceholderCard
            title={t("dialogue.noDialogueNodes")}
            description={t("dialogue.startConversation")}
            actionText={t("common.return")}
            onAction={() => {
              trackButtonClick("DialogueTreeModal", "close_empty");
              onClose();
            }}
            fontClass={fontClass}
            serifFontClass={serifFontClass}
          />
        ) : (
          <div className="h-[calc(100%-6rem)] w-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={handleNodeDragStop}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              proOptions={{ hideAttribution: true }}
              connectionLineType={ConnectionLineType.SmoothStep}
              defaultEdgeOptions={defaultEdgeOptions}
            >
              <MiniMap
                nodeStrokeWidth={3}
                nodeColor="var(--color-primary)"
                maskColor="rgba(30, 28, 27, 0.5)"
                className=" border border-border rounded-md  overflow-hidden bg-[rgba(28,28,27,0.7)]"
              />
              <Background color="var(--color-ink)" gap={16} size={1.5} />
              <Panel position="top-right" className=" border border-border p-3 rounded-md  flex items-center gap-2">
                <span className={`text-primary text-xs ${fontClass}`}>
                  {layoutMethod === "elk" ? "ELK" : "Grid"} · {manualCount} {t("dialogue.manualPositions")}
                </span>
                <Button variant="ghost" size="sm" onClick={() => handleResetLayout()}>
                  {t("dialogue.resetLayout")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadDialogue(dataLoaded ? "incremental" : "full")}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? t("common.loading") : t("common.refresh")}
                </Button>
                <Button variant="outline" size="sm" onClick={handleHighlightPath}>
                  {t("dialogue.highlightPath")}
                </Button>
              </Panel>
            </ReactFlow>
          </div>
        )}

        {isEditModalOpen && selectedNode && (
          <DialogueEditModal
            node={selectedNode}
            isSaving={isSaving}
            editContent={editContent}
            onChange={setEditContent}
            onClose={() => setIsEditModalOpen(false)}
            onSave={saveEditContent}
            fontClass={fontClass}
            serifFontClass={serifFontClass}
            modalRef={editModalRef}
            t={t}
          />
        )}
      </div>
    </div>
  );
}
