/**
 * @input  hooks/script-bridge/capability-matrix-slash-core, hooks/script-bridge/capability-matrix-slash-extended
 * @output SLASH_COMMAND_MATRIX
 * @pos    脚本桥接 slash 命令能力清单聚合入口
 * @update 一旦我被更新，务必同步更新 api-surface-contract 与 docs 说明。
 */

import { SLASH_COMMAND_CORE_MATRIX } from "./capability-matrix-slash-core";
import { SLASH_COMMAND_EXTENDED_MATRIX } from "./capability-matrix-slash-extended";

export const SLASH_COMMAND_MATRIX = [
  ...SLASH_COMMAND_CORE_MATRIX,
  ...SLASH_COMMAND_EXTENDED_MATRIX,
] as const;
