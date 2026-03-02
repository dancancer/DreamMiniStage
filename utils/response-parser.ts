/**
 * @input  (none)
 * @output parseEvent
 * @pos    响应解析工具 - 从 LLM 响应中提取 <event> 标签内容
 * @update 一旦我被更新，务必更新我的开头注释，以及所属文件夹的 README.md
 */

export function parseEvent(story: string): string {
  const eventStart = story.indexOf("<event>");
  const eventEnd = story.indexOf("</event>");
  if (eventStart !== -1 && eventEnd !== -1) {
    return story.substring(eventStart + 7, eventEnd).trim();
  }
  return story;
}
