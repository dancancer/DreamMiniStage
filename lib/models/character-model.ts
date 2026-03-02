/**
 * @input  无外部依赖
 * @output CharacterData, TavernHelperScript, TavernHelperScriptValue
 * @pos    角色卡数据模型,定义角色基本信息、扩展属性、脚本配置
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

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
/* ═══════════════════════════════════════════════════════════════════════════
   TavernHelper 脚本值定义

   data 字段：脚本自定义数据，使用 unknown 表达任意 JSON 可序列化值
   设计理念：Record<string, unknown> 精确描述了 JSON 对象的本质
   ═══════════════════════════════════════════════════════════════════════════ */
export interface TavernHelperScriptValue {
  id: string;
  name: string;
  content: string;
  info?: string;
  buttons?: TavernHelperScriptButton[];
  data?: Record<string, unknown>;
  enabled?: boolean;
}

/**
 * TavernHelper Script Entry (can be in different formats)
 */
export type TavernHelperScript =
  | { type: "script"; value: TavernHelperScriptValue }  // New format with nested value
  | { name: string; content: string; enabled?: boolean; id?: string }  // Legacy simple format
  | TavernHelperScriptValue;  // Direct value format

/* ═══════════════════════════════════════════════════════════════════════════
   角色数据定义

   extensions 字段：扩展属性字典
   - TavernHelper_scripts 是已知扩展
   - 索引签名使用 unknown 允许任意扩展同时保持类型安全
   设计理念：明确已知字段，放宽未知字段，但保持类型系统完整性
   ═══════════════════════════════════════════════════════════════════════════ */
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
    [key: string]: unknown;
  };
}
