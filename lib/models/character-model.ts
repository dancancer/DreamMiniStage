/**
 * TavernHelper Script Button Configuration
 */
export interface TavernHelperScriptButton {
  name: string;
  visible: boolean;
}

/**
 * TavernHelper Script Value (full format from character card)
 */
export interface TavernHelperScriptValue {
  id: string;
  name: string;
  content: string;
  info?: string;
  buttons?: TavernHelperScriptButton[];
  data?: Record<string, any>;
  enabled?: boolean;
}

/**
 * TavernHelper Script Entry (can be in different formats)
 */
export type TavernHelperScript =
  | { type: "script"; value: TavernHelperScriptValue }  // New format with nested value
  | { name: string; content: string; enabled?: boolean; id?: string }  // Legacy simple format
  | TavernHelperScriptValue;  // Direct value format

export interface CharacterData {
  name: string;
  description: string;
  personality: string;
  first_mes: string;
  scenario: string;
  mes_example: string;
  creatorcomment: string;
  avatar: string;
  creator_notes?: string;
  imagePath?: string;
  alternate_greetings:string[];
  extensions?: {
    TavernHelper_scripts?: TavernHelperScript[];
    [key: string]: any;
  };
}
