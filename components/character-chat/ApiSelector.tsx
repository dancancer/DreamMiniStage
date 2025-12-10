/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         API Selector Component                             ║
 * ║                                                                            ║
 * ║  两级下拉选择器：API 配置 → 可用模型                                        ║
 * ║  职责单一：只负责 API/模型的可视化选择                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import Image from "next/image";
import { ChevronDown, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { resolveApiIcon } from "@/lib/utils/api-icon-resolver";
import type { APIConfig } from "@/hooks/useApiConfig";
import { Button } from "@/components/ui/button";

// ============================================================================
//                              类型定义
// ============================================================================

interface ApiSelectorProps {
  configs: APIConfig[];
  activeConfigId: string;
  showApiDropdown: boolean;
  showModelDropdown: boolean;
  selectedConfigId: string;
  onToggleDropdown: () => void;
  onConfigSelect: (configId: string) => void;
  onModelSelect: (configId: string, modelName: string) => void;
  onBackToConfigs: () => void;
  t: (key: string) => string;
}

// ============================================================================
//                              图标渲染
// ============================================================================

function ApiIcon({ name }: { name: string }) {
  const { src, alt } = resolveApiIcon(name);
  return (
    <div className="w-5 h-5 rounded-full overflow-hidden bg-transparent flex items-center justify-center">
      <Image src={src} alt={alt} width={20} height={20} className="object-cover w-full h-full" />
    </div>
  );
}

// ============================================================================
//                              主组件
// ============================================================================

export default function ApiSelector({
  configs,
  activeConfigId,
  showApiDropdown,
  showModelDropdown,
  selectedConfigId,
  onToggleDropdown,
  onConfigSelect,
  onModelSelect,
  onBackToConfigs,
  t,
}: ApiSelectorProps) {
  const currentConfig = configs.find((c) => c.id === activeConfigId);
  const selectedConfig = configs.find((c) => c.id === selectedConfigId);

  return (
    <div className="relative mx-2 api-dropdown-container">
      {/* 主按钮 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleDropdown}
        className="p-1 h-auto w-auto group relative text-text-muted hover:text-primary flex items-center"
      >
        <div className="flex items-center">
          <ApiIcon name={currentConfig?.name || "openai"} />
          <ChevronDown className="h-2 w-2 ml-0.5" strokeWidth={3} />
        </div>
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-overlay text-cream text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap border border-border z-50">
          {currentConfig?.name || t("modelSettings.noConfigs")}
        </div>
      </Button>

      {/* 第一层：API 配置列表 */}
      {showApiDropdown && !showModelDropdown && (
        <ConfigDropdown
          configs={configs}
          activeConfigId={activeConfigId}
          onSelect={onConfigSelect}
          emptyText={t("common.noApisConfigured")}
        />
      )}

      {/* 第二层：模型列表 */}
      {showModelDropdown && selectedConfig && (
        <ModelDropdown
          config={selectedConfig}
          onBack={onBackToConfigs}
          onSelect={(modelName) => onModelSelect(selectedConfigId, modelName)}
          t={t}
        />
      )}
    </div>
  );
}

// ============================================================================
//                              子组件
// ============================================================================

interface ConfigDropdownProps {
  configs: APIConfig[];
  activeConfigId: string;
  onSelect: (configId: string) => void;
  emptyText: string;
}

function ConfigDropdown({ configs, activeConfigId, onSelect, emptyText }: ConfigDropdownProps) {
  if (configs.length === 0) {
    return (
      <div className="absolute top-full left-0 mt-1 bg-overlay border border-border rounded-md  z-50 min-w-[160px]">
        <div className="px-2 py-1.5 text-xs text-text-muted">{emptyText}</div>
      </div>
    );
  }

  return (
    <div className="absolute top-full left-0 mt-1 bg-overlay border border-border rounded-md  z-50 min-w-[160px]">
      {configs.map((config) => (
        <Button
          key={config.id}
          variant="ghost"
          onClick={() => onSelect(config.id)}
          className={`w-full justify-start text-left px-2 py-1.5 h-auto text-xs hover:bg-accent hover:text-accent-foreground flex items-center ${
            activeConfigId === config.id ? "bg-accent text-accent-foreground" : "text-cream"
          }`}
        >
          <div className="flex items-center flex-1">
            <span className="mr-2.5"><ApiIcon name={config.name} /></span>
            <span className="truncate" title={config.name}>
              {config.name.length > 20 ? `${config.name.substring(0, 20)}...` : config.name}
            </span>
          </div>
          <ChevronRight className="h-3 w-3 ml-2" />
        </Button>
      ))}
    </div>
  );
}

interface ModelDropdownProps {
  config: APIConfig;
  onBack: () => void;
  onSelect: (modelName: string) => void;
  t: (key: string) => string;
}

function ModelDropdown({ config, onBack, onSelect, t }: ModelDropdownProps) {
  const models = config.availableModels;

  return (
    <div className="absolute top-full left-0 mt-1 bg-overlay border border-border rounded-md  z-50 min-w-[180px]">
      {/* 头部：返回按钮 */}
      <div className="px-2 py-1.5 text-xs text-text-muted border-b border-border flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="flex items-center text-primary-soft hover:text-primary h-auto p-0"
        >
          <ChevronLeft className="h-3 w-3 mr-1" />
          {t("characterChat.back")}
        </Button>
        <span>{t("characterChat.selectModel")}</span>
      </div>

      {/* 模型列表或加载状态 */}
      {!models ? (
        <LoadingIndicator />
      ) : (
        models.map((modelName) => (
          <ModelItem
            key={modelName}
            modelName={modelName}
            configName={config.name}
            isActive={config.model === modelName}
            onSelect={() => onSelect(modelName)}
            defaultLabel={t("characterChat.defaultModel")}
          />
        ))
      )}
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="px-2 py-1.5 text-xs text-text-muted flex items-center">
      <Loader2 className="animate-spin h-3 w-3 mr-2" />
      Loading models...
    </div>
  );
}

interface ModelItemProps {
  modelName: string;
  configName: string;
  isActive: boolean;
  onSelect: () => void;
  defaultLabel: string;
}

function ModelItem({ modelName, configName, isActive, onSelect, defaultLabel }: ModelItemProps) {
  const isDefault = modelName === "default";
  const displayName = isDefault ? defaultLabel : modelName;
  const truncatedName = displayName.length > 25 ? `${displayName.substring(0, 25)}...` : displayName;

  return (
    <Button
      variant="ghost"
      onClick={onSelect}
      className={`w-full justify-start text-left px-2 py-1.5 h-auto text-xs hover:bg-accent hover:text-accent-foreground flex items-center ${
        isActive ? "bg-accent text-accent-foreground" : "text-cream"
      }`}
    >
      <span className="mr-2.5">
        <ApiIcon name={isDefault ? configName : modelName} />
      </span>
      <span className="truncate" title={displayName}>{truncatedName}</span>
    </Button>
  );
}
