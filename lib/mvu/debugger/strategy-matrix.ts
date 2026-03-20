export type MvuStrategyId =
  | "text-delta"
  | "function-calling"
  | "extra-model";

export type MvuStrategySupport =
  | "default"
  | "conditional"
  | "unsupported";

export interface MvuStrategyEntry {
  id: MvuStrategyId;
  support: MvuStrategySupport;
  hasProductEntry: boolean;
  visibleInDebugger: boolean;
  summary: string;
  failFastReason?: string;
}

export interface MvuStrategyRecommendation {
  primary: MvuStrategyEntry;
  secondary: MvuStrategyEntry | null;
}

export const MVU_STRATEGY_MATRIX: MvuStrategyEntry[] = [
  {
    id: "text-delta",
    support: "default",
    hasProductEntry: true,
    visibleInDebugger: true,
    summary: "当前唯一默认产品路径：助手最终文本 -> MVU delta 解析 -> 节点变量快照落盘。",
  },
  {
    id: "function-calling",
    support: "conditional",
    hasProductEntry: false,
    visibleInDebugger: true,
    summary: "工具 schema 与管理器已存在，但当前产品没有显式配置入口，也没有会话级持久化开关。",
    failFastReason: "除非后续显式接入策略配置，否则 function-calling 不应抢占默认文本 delta 路径。",
  },
  {
    id: "extra-model",
    support: "conditional",
    hasProductEntry: false,
    visibleInDebugger: true,
    summary: "额外模型解析器与世界书过滤器已存在，但当前仍属于显式扩展路径，不是默认工作流。",
    failFastReason: "只有在作者明确需要 [mvu_update] 风格规则时，extra-model 才值得被进一步配置化。",
  },
];

export function getDefaultMvuStrategy(): MvuStrategyEntry {
  return MVU_STRATEGY_MATRIX.find((entry) => entry.id === "text-delta")!;
}

export function getRecommendedMvuStrategy(params: {
  hasUpdateMarker: boolean;
}): MvuStrategyRecommendation {
  const primary = getDefaultMvuStrategy();
  const secondary = params.hasUpdateMarker
    ? MVU_STRATEGY_MATRIX.find((entry) => entry.id === "extra-model") ?? null
    : null;

  return {
    primary,
    secondary,
  };
}
