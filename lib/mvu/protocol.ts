/**
 * @input  none
 * @output stripMvuProtocolBlocks
 * @pos    MVU 协议文本工具 - 清理不应直接暴露给用户的 UpdateVariable 协议块
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

const UPDATE_VARIABLE_BLOCK = /\n*\s*<UpdateVariable>[\s\S]*?<\/UpdateVariable>\s*\n*/gi;

export function stripMvuProtocolBlocks(content: string): string {
  if (!content) {
    return "";
  }

  return content
    .replace(UPDATE_VARIABLE_BLOCK, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
