export const RENDER_INTENT_SCHEMA_VERSION = 1;

export type RegexClassificationKind =
  | "input_filter"
  | "output_filter"
  | "prompt_transform"
  | "display_transform"
  | "state_update"
  | "render_intent_extractor"
  | "unsupported";

export type RenderIntentKind =
  | "choice-list"
  | "collapsible-panel"
  | "status-panel"
  | "state-panel";

export type UnsupportedFallbackAction = "disable" | "plain-text";

export interface RegexClassification {
  scriptId: string;
  scriptName: string;
  kind: RegexClassificationKind;
  confidence: number;
  canExtractRenderIntent: boolean;
  reasons: string[];
  unsupportedReason?: string;
}

export interface UnsupportedRegexFallback {
  scriptId: string;
  scriptName: string;
  reason: string;
  rawSummary: string;
  allowedActions: UnsupportedFallbackAction[];
  plainText: string;
}

export interface RenderIntentBase {
  schemaVersion: typeof RENDER_INTENT_SCHEMA_VERSION;
  id: string;
  kind: RenderIntentKind;
  sourceScriptId: string;
  title: string;
  confidence: number;
}

export interface ChoiceListRenderIntent extends RenderIntentBase {
  kind: "choice-list";
  options: ChoiceOption[];
}

export interface ChoiceOption {
  id: string;
  labelTemplate: string;
  descriptionTemplate?: string;
  action: {
    type: "append-input";
    valueTemplate: string;
  };
}

export interface CollapsiblePanelRenderIntent extends RenderIntentBase {
  kind: "collapsible-panel";
  bodyTemplate: string;
  collapsedLabel: string;
  expandedLabel: string;
}

export interface StatusPanelRenderIntent extends RenderIntentBase {
  kind: "status-panel";
  fields: StatusPanelField[];
  dataTemplate?: string;
  sourcePattern?: string;
}

export interface StatePanelRenderIntent extends RenderIntentBase {
  kind: "state-panel";
  dataTemplate: string;
  sourcePattern: string;
}

export interface StatusPanelField {
  label: string;
  valueTemplate: string;
}

export type RenderIntent =
  | ChoiceListRenderIntent
  | CollapsiblePanelRenderIntent
  | StatusPanelRenderIntent
  | StatePanelRenderIntent;

export interface RenderIntentConversion {
  classification: RegexClassification;
  intent?: RenderIntent;
  fallback?: UnsupportedRegexFallback;
}
