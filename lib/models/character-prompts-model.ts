/**
 * @input  无外部依赖
 * @output CharacterPromptParams
 * @pos    角色提示词参数模型,定义 prompt 构建所需的全部变量
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

export interface CharacterPromptParams {
  username?: string;
  name: string;
  number: number;
  prefixPrompt?: string;
  chainOfThoughtPrompt?: string;
  suffixPrompt?: string;
  language?: "zh" | "en";
  systemPrompt?: string;
  storyHistory?: string;
  conversationHistory?: string;
  userInput?: string;
  sampleStatus?: string;
}
