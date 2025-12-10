/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                       worldbook-editor 导出与类型                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

export interface WorldBookEntryData {
  entry_id: string;
  id?: number;
  content: string;
  keys: string[];
  secondary_keys: string[];
  selective: boolean;
  constant: boolean;
  position: string | number;
  insertion_order: number;
  enabled: boolean;
  use_regex: boolean;
  depth: number;
  comment: string;
  tokens?: number;
  extensions?: unknown;
  primaryKey: string;
  keyCount: number;
  secondaryKeyCount: number;
  contentLength: number;
  isActive: boolean;
  lastUpdated: number;
  isImported: boolean;
  importedAt: number | null;
}

export interface EditingEntry {
  entry_id: string;
  id?: number;
  comment: string;
  keys: string[];
  secondary_keys: string[];
  content: string;
  position: number;
  depth: number;
  enabled: boolean;
  use_regex: boolean;
  selective: boolean;
  constant: boolean;
  insertion_order: number;
}

export { WorldBookHeader } from "./WorldBookHeader";
export { WorldBookControls } from "./WorldBookControls";
export { WorldBookTable } from "./WorldBookTable";
