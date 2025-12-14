/**
 * 手动模拟消息拼装流程
 * 
 * 模拟场景：Sgw3.card.json + 明月秋青v3.94.json + 用户输入"推进剧情"
 * 
 * 运行方式：npx ts-node scripts/debug-prompt-assembly.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "lib/core/__tests__/prompt-assembly-debug-output.json");

interface CharacterCard {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  data?: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    character_book?: {
      name: string;
      entries: Array<{
        keys: string[];
        content: string;
        enabled: boolean;
        position?: number;
        comment?: string;
        extensions?: {
          position?: number;
        };
      }>;
    };
    extensions?: {
      world?: string;
    };
  };
}

interface PresetMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function main() {
  console.log("=== 消息拼装调试脚本 ===\n");

  // 0. 加载 messageList.json 作为对比基准
  const messageListPath = path.join(PROJECT_ROOT, "messageList.json");
  let actualMessageList: any = null;
  if (fs.existsSync(messageListPath)) {
    const messageListContent = fs.readFileSync(messageListPath, "utf-8");
    actualMessageList = JSON.parse(messageListContent);
    console.log("[0] 加载 messageList.json 作为对比基准");
  }

  // 1. 加载角色卡
  const cardPath = path.join(PROJECT_ROOT, "Sgw3.card.json");
  const cardContent = fs.readFileSync(cardPath, "utf-8");
  const characterCard: CharacterCard = JSON.parse(cardContent);
  console.log(`[1] 加载角色卡: ${characterCard.name || characterCard.data?.name}`);

  // 2. 加载预设
  const presetPath = path.join(PROJECT_ROOT, "明月秋青v3.94.json");
  const presetContent = fs.readFileSync(presetPath, "utf-8");
  const presetMessages: PresetMessage[] = JSON.parse(presetContent);
  console.log(`[2] 加载预设: ${presetMessages.length} 条消息`);

  // 3. 用户输入
  const userInput = "推进剧情";
  console.log(`[3] 用户输入: "${userInput}"`);

  // 4. 提取预设中的 system 和 user 消息
  const systemMessages = presetMessages.filter(m => m.role === "system");
  const userMessages = presetMessages.filter(m => m.role === "user");

  console.log(`[4] 预设消息分布: system=${systemMessages.length}, user=${userMessages.length}`);

  // 5. 基础消息
  const baseSystemMessage = systemMessages.map(m => m.content).join("\n\n");
  const baseUserMessage = userMessages.map(m => m.content).join("\n\n");

  console.log(`[5] 基础 systemMessage 长度: ${baseSystemMessage.length} 字符`);
  console.log(`[5] 基础 userMessage 长度: ${baseUserMessage.length} 字符`);
  console.log(`[5] 基础 userMessage 内容:\n---\n${baseUserMessage}\n---`);

  // 6. 检查 userMessage 是否包含 {{userInput}}
  const hasUserInputPlaceholder = baseUserMessage.includes("{{userInput}}");
  console.log(`[6] userMessage 包含 {{userInput}}: ${hasUserInputPlaceholder}`);

  // 7. 处理用户输入（模拟 PromptAssembler 的逻辑）
  let finalUserMessage = baseUserMessage;
  if (baseUserMessage.includes("{{userInput}}")) {
    finalUserMessage = baseUserMessage.replace("{{userInput}}", userInput);
    console.log("[7] 替换 {{userInput}} 占位符");
  } else {
    // 预设无占位符时，在开头插入用户输入
    finalUserMessage = `${userInput}${baseUserMessage}`;
    console.log("[7] 在开头插入用户输入（预设无占位符）");
  }

  console.log(`[7] 最终 userMessage 长度: ${finalUserMessage.length} 字符`);
  console.log(`[7] 最终 userMessage 内容:\n---\n${finalUserMessage}\n---`);

  // 8. 检查用户输入是否被包含
  const userInputIncluded = finalUserMessage.includes(userInput);
  console.log(`[8] 用户输入是否被包含: ${userInputIncluded}`);

  // 9. 模拟最终发送的消息结构（类似 messageList.json）
  const finalMessages = [
    {
      role: "system",
      content: baseSystemMessage,
    },
    {
      role: "user",
      content: finalUserMessage,
    },
  ];

  // 10. 写入输出文件
  const output = {
    testName: "手动拼装调试",
    timestamp: new Date().toISOString(),
    inputs: {
      characterCardName: characterCard.name || characterCard.data?.name || "Unknown",
      presetName: "明月秋青v3.94",
      userInput,
    },
    analysis: {
      presetSystemMessagesCount: systemMessages.length,
      presetUserMessagesCount: userMessages.length,
      baseSystemMessageLength: baseSystemMessage.length,
      baseUserMessageLength: baseUserMessage.length,
      hasUserInputPlaceholder,
      finalUserMessageLength: finalUserMessage.length,
      userInputIncluded,
    },
    outputs: {
      systemMessage: baseSystemMessage,
      userMessage: finalUserMessage,
      messages: finalMessages,
    },
    comparison: {
      originalUserMessage: baseUserMessage,
      finalUserMessage: finalUserMessage,
      difference: finalUserMessage.length - baseUserMessage.length,
    },
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\n[输出] 结果已写入: ${OUTPUT_FILE}`);

  // 11. 对比 messageList.json
  if (actualMessageList) {
    console.log("\n=== 对比 messageList.json ===");
    console.log("messageList.json 中的 user message:");
    const actualUserMessage = actualMessageList.messages?.find((m: any) => m.role === "user")?.content || "";
    console.log(`---\n${actualUserMessage}\n---`);
    
    console.log(`\n实际是否包含用户输入 "${userInput}": ${actualUserMessage.includes(userInput)}`);
    
    // 对比差异
    console.log("\n=== 差异分析 ===");
    console.log(`预期 userMessage 长度: ${finalUserMessage.length}`);
    console.log(`实际 userMessage 长度: ${actualUserMessage.length}`);
    console.log(`差异: ${finalUserMessage.length - actualUserMessage.length} 字符`);
    
    if (finalUserMessage !== actualUserMessage) {
      console.log("\n⚠️ 预期与实际不一致！");
      console.log("预期 userMessage 末尾 100 字符:");
      console.log(`---\n${finalUserMessage.slice(-100)}\n---`);
      console.log("实际 userMessage 末尾 100 字符:");
      console.log(`---\n${actualUserMessage.slice(-100)}\n---`);
    } else {
      console.log("\n✅ 预期与实际一致");
    }
  }

  console.log("\n=== 完成 ===");
}

main().catch(console.error);
