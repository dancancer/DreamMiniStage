/**
 * @input  hooks/script-bridge/capability-matrix-api, hooks/script-bridge/capability-matrix-slash
 * @output SCRIPT_BRIDGE_API_MATRIX, SLASH_COMMAND_MATRIX
 * @pos    脚本桥接能力矩阵聚合入口
 * @update 一旦我被更新，务必同步更新 api-surface-contract 与 docs 说明。
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Script Bridge 能力矩阵                             ║
 * ║                                                                            ║
 * ║  API 与 slash 清单各自维护，本文件只保留统一导出入口。                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

export { SCRIPT_BRIDGE_API_MATRIX } from "./capability-matrix-api";
export { SLASH_COMMAND_MATRIX } from "./capability-matrix-slash";
