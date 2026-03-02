/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     消息后处理管线                                          ║
 * ║                                                                            ║
 * ║  职责：                                                                     ║
 * ║  1. 多模态内容处理（提取文本、添加前缀、合并内容）                              ║
 * ║  2. 名称规范化（将 name 字段转为 content 前缀）                               ║
 * ║  3. 角色合并（合并连续同角色消息）                                            ║
 * ║  4. 严格模式处理（确保 user 起始、占位符插入）                                 ║
 * ║  5. 工具调用处理（保留或剥离 tool_calls）                                     ║
 * ║  6. Prefill 应用（assistant 预填充）                                        ║
 * ║                                                                            ║
 * ║  Requirements: 1.1-1.5, 2.1-2.5, 3.1-3.4, 4.1-4.3, 5.1-5.4, 6.1-6.4       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import {
  PostProcessingMode,
  type ExtendedChatMessage,
  type ContentPart,
  type TextContentPart,
  type PromptNames,
  type PostProcessOptions,
} from "../st-preset-types";

/* ═══════════════════════════════════════════════════════════════════════════
   多模态内容辅助函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 从 content 中提取纯文本
 *
 * 处理逻辑：
 * - string: 直接返回
 * - ContentPart[]: 提取所有 text 类型片段，用换行连接
 *
 * Requirements: 3.4
 *
 * @param content - 消息内容（string 或 ContentPart[]）
 * @returns 提取的纯文本
 */
export function getTextContent(content: string | ContentPart[]): string {
  if (typeof content === "string") {
    return content;
  }

  return content
    .filter((part): part is TextContentPart => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

/**
 * 向 content 添加前缀
 *
 * 处理逻辑：
 * - string: 直接拼接 prefix + content
 * - ContentPart[]: 在首个 text 片段前添加，若无 text 则插入新片段
 *
 * Requirements: 3.2
 *
 * @param content - 原始内容
 * @param prefix - 要添加的前缀
 * @returns 添加前缀后的内容（保持原类型）
 */
export function prependToContent(
  content: string | ContentPart[],
  prefix: string,
): string | ContentPart[] {
  if (typeof content === "string") {
    return prefix + content;
  }

  // 空数组：插入新 text 片段
  if (content.length === 0) {
    return [{ type: "text", text: prefix }];
  }

  // 查找首个 text 片段
  const firstTextIndex = content.findIndex((part) => part.type === "text");

  if (firstTextIndex === -1) {
    // 无 text 片段：在开头插入
    return [{ type: "text", text: prefix }, ...content];
  }

  // 在首个 text 片段前添加 prefix
  const result = [...content];
  const textPart = result[firstTextIndex] as TextContentPart;
  result[firstTextIndex] = { type: "text", text: prefix + textPart.text };

  return result;
}

/**
 * 合并两个 content
 *
 * 处理逻辑：
 * - 两个 string: 用换行连接
 * - 两个 array: 直接拼接
 * - 混合类型: 将 string 转为 TextContentPart 后拼接
 *
 * Requirements: 3.2, 3.3
 *
 * @param a - 第一个内容
 * @param b - 第二个内容
 * @returns 合并后的内容
 */
export function mergeContent(
  a: string | ContentPart[],
  b: string | ContentPart[],
): string | ContentPart[] {
  const aIsString = typeof a === "string";
  const bIsString = typeof b === "string";

  // 两个 string：换行连接
  if (aIsString && bIsString) {
    return a + "\n" + b;
  }

  // 转换为数组后拼接
  const aParts: ContentPart[] = aIsString ? [{ type: "text", text: a }] : a;
  const bParts: ContentPart[] = bIsString ? [{ type: "text", text: b }] : b;

  return [...aParts, ...bParts];
}

/* ═══════════════════════════════════════════════════════════════════════════
   名称规范化
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 名称规范化 - 将 name 字段转为 content 前缀
 *
 * 处理逻辑：
 * - example_assistant → charName 前缀
 * - example_user → userName 前缀
 * - 群聊成员名 → 成员名前缀
 * - 普通 name → name 前缀
 * - system 角色不添加前缀
 * - 处理后移除 name 字段
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 *
 * @param messages - 消息数组
 * @param names - 角色名称集合
 * @returns 规范化后的消息数组
 */
export function normalizeNames(
  messages: ExtendedChatMessage[],
  names: PromptNames,
): ExtendedChatMessage[] {
  return messages.map((msg) => {
    // 无 name 字段：原样返回
    if (!msg.name) {
      return msg;
    }

    // system 角色不添加前缀，但仍需移除 name
    if (msg.role === "system") {
      const { name: _, ...rest } = msg;
      return rest as ExtendedChatMessage;
    }

    // 计算前缀
    const prefix = resolveNamePrefix(msg.name, names);

    // 无前缀（空 charName/userName）：仅移除 name
    if (!prefix) {
      const { name: _, ...rest } = msg;
      return rest as ExtendedChatMessage;
    }

    // 检查是否已有前缀（幂等性）
    const textContent = getTextContent(msg.content);
    if (textContent.startsWith(prefix) || names.startsWithGroupName(textContent)) {
      const { name: _, ...rest } = msg;
      return rest as ExtendedChatMessage;
    }

    // 添加前缀并移除 name
    const { name: _, ...rest } = msg;
    return {
      ...rest,
      content: prependToContent(msg.content, prefix),
    } as ExtendedChatMessage;
  });
}

/**
 * 解析名称前缀
 *
 * 优先级：
 * 1. example_assistant → charName
 * 2. example_user → userName
 * 3. 群聊成员名 → 成员名
 * 4. 普通 name → name
 *
 * @param name - 消息的 name 字段
 * @param names - 角色名称集合
 * @returns 前缀字符串（含 ": " 后缀），或空字符串
 */
function resolveNamePrefix(name: string, names: PromptNames): string {
  if (name === "example_assistant") {
    return names.charName ? `${names.charName}: ` : "";
  }

  if (name === "example_user") {
    return names.userName ? `${names.userName}: ` : "";
  }

  // 检查是否为群聊成员名
  if (names.groupNames.includes(name)) {
    return `${name}: `;
  }

  // 普通 name：直接使用
  return name ? `${name}: ` : "";
}

/* ═══════════════════════════════════════════════════════════════════════════
   角色合并
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   严格模式处理
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 将非首条 system 消息转为 user
 *
 * 设计哲学：
 * - 只有首条消息可以是 system（作为系统提示）
 * - 后续的 system 消息降级为 user，保持语义但符合 API 要求
 * - 通过索引判断消除特殊情况，无需额外状态
 *
 * Requirements: 1.2
 *
 * @param messages - 消息数组
 * @returns 处理后的消息数组
 */
export function convertMidSystemToUser(
  messages: ExtendedChatMessage[],
): ExtendedChatMessage[] {
  return messages.map((msg, i) =>
    i > 0 && msg.role === "system"
      ? { ...msg, role: "user" as const }
      : msg,
  );
}

/** 默认占位符文本 */
const DEFAULT_PLACEHOLDER = "Let's get started.";

/**
 * 确保首条非 system 消息为 user
 *
 * 设计哲学：
 * - 某些 API（如 Perplexity）要求首条非 system 消息必须是 user
 * - 通过插入占位符消息满足约束，而非修改现有消息
 * - 三种情况统一处理：
 *   1. 首条是 system，第二条不是 user → 在 system 后插入
 *   2. 首条不是 system 也不是 user → 在开头插入
 *   3. 其他情况 → 无需处理
 *
 * Requirements: 1.3, 5.2, 5.3
 *
 * @param messages - 消息数组
 * @param placeholder - 占位符文本
 * @returns 处理后的消息数组
 */
export function ensureUserStart(
  messages: ExtendedChatMessage[],
  placeholder: string = DEFAULT_PLACEHOLDER,
): ExtendedChatMessage[] {
  if (messages.length === 0) {
    return messages;
  }

  const first = messages[0];

  // 情况 1: 首条是 system
  if (first.role === "system") {
    // 只有一条消息，或第二条不是 user → 插入占位符
    if (messages.length === 1 || messages[1].role !== "user") {
      return [
        first,
        { role: "user", content: placeholder },
        ...messages.slice(1),
      ];
    }
    return messages;
  }

  // 情况 2: 首条不是 system 也不是 user → 在开头插入
  if (first.role !== "user") {
    return [{ role: "user", content: placeholder }, ...messages];
  }

  // 情况 3: 首条已经是 user → 无需处理
  return messages;
}

/**
 * 确保消息数组非空
 *
 * 设计哲学：
 * - 空消息数组会导致 API 请求失败
 * - 通过插入占位符消息兜底，保证请求总能发出
 * - 最简单的边界情况处理：空 → 单条 user
 *
 * Requirements: 5.1
 *
 * @param messages - 消息数组
 * @param placeholder - 占位符文本
 * @returns 非空的消息数组
 */
export function ensureNonEmpty(
  messages: ExtendedChatMessage[],
  placeholder: string = DEFAULT_PLACEHOLDER,
): ExtendedChatMessage[] {
  if (messages.length === 0) {
    return [{ role: "user", content: placeholder }];
  }
  return messages;
}

/* ═══════════════════════════════════════════════════════════════════════════
   工具调用处理
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 剥离工具调用相关字段
 *
 * 设计哲学：
 * - 当 API 不支持工具调用时，需要安全降级
 * - 移除 tool_calls 和 tool_call_id 字段
 * - 将 tool 角色转为 user，保留内容语义
 * - 通过统一转换消除特殊情况，无需分支判断
 *
 * Requirements: 4.2, 4.3
 *
 * @param messages - 消息数组
 * @returns 剥离工具字段后的消息数组
 */
export function stripTools(
  messages: ExtendedChatMessage[],
): ExtendedChatMessage[] {
  return messages.map((msg) => {
    // 解构移除 tool_calls 和 tool_call_id
    const { tool_calls: _, tool_call_id: __, ...rest } = msg;

    // tool 角色转为 user
    if (rest.role === "tool") {
      return { ...rest, role: "user" as const };
    }

    return rest as ExtendedChatMessage;
  });
}

/**
 * 合并连续同角色消息
 *
 * 设计哲学：
 * - 通过统一的合并逻辑消除特殊情况
 * - tool 角色天然不参与合并（保持工具调用的独立性）
 * - forceSingleUser 模式将所有消息视为 user，实现极致合并
 *
 * Requirements: 1.1, 1.4
 *
 * @param messages - 消息数组
 * @param forceSingleUser - 是否强制所有消息合并为单条 user
 * @returns 合并后的消息数组
 */
export function mergeConsecutiveRoles(
  messages: ExtendedChatMessage[],
  forceSingleUser: boolean = false,
): ExtendedChatMessage[] {
  if (messages.length === 0) {
    return [];
  }

  const result: ExtendedChatMessage[] = [];

  for (const msg of messages) {
    // tool 角色永不合并，保持独立
    if (msg.role === "tool") {
      result.push({ ...msg });
      continue;
    }

    // 计算有效角色：forceSingleUser 模式下全部视为 user
    const effectiveRole = forceSingleUser ? "user" : msg.role;
    const last = result[result.length - 1];

    // 判断是否可以合并：
    // 1. 存在前一条消息
    // 2. 前一条不是 tool
    // 3. 有效角色相同
    const canMerge = last && last.role !== "tool" && last.role === effectiveRole;

    if (canMerge) {
      // 合并内容到前一条消息
      last.content = mergeContent(last.content, msg.content);
    } else {
      // 创建新消息，使用有效角色
      result.push({ ...msg, role: effectiveRole });
    }
  }

  return result;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Prefill 应用
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 检查消息数组是否包含工具调用
 *
 * @param messages - 消息数组
 * @returns 是否包含 tool_calls 或 tool 角色
 */
function hasTools(messages: ExtendedChatMessage[]): boolean {
  return messages.some(
    (msg) => msg.tool_calls?.length || msg.role === "tool",
  );
}

/**
 * 应用 Assistant Prefill
 *
 * 设计哲学：
 * - Prefill 用于引导模型从特定内容开始生成
 * - 若最后一条是 assistant，设置 prefix=true 标记
 * - 若最后一条不是 assistant，追加新 assistant 消息
 * - 有工具调用时跳过，避免干扰工具流程
 * - 去除尾部空白，保持输出整洁
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 *
 * @param messages - 消息数组
 * @param prefill - Prefill 内容
 * @param hasToolsInPrompt - 是否有工具调用（可选，默认自动检测）
 * @returns 应用 prefill 后的消息数组
 */
export function applyPrefill(
  messages: ExtendedChatMessage[],
  prefill: string,
  hasToolsInPrompt?: boolean,
): ExtendedChatMessage[] {
  // 空 prefill：原样返回
  if (!prefill || !prefill.trim()) {
    return messages;
  }

  // 有工具时跳过：避免干扰工具调用流程
  const toolsPresent = hasToolsInPrompt ?? hasTools(messages);
  if (toolsPresent) {
    return messages;
  }

  // 空消息数组：追加新 assistant 消息
  if (messages.length === 0) {
    return [{ role: "assistant", content: prefill.trimEnd(), prefix: true }];
  }

  const result = [...messages];
  const last = result[result.length - 1];

  // 最后一条是 assistant：设置 prefix=true
  if (last.role === "assistant") {
    result[result.length - 1] = { ...last, prefix: true };
    return result;
  }

  // 最后一条不是 assistant：追加新消息
  result.push({ role: "assistant", content: prefill.trimEnd(), prefix: true });
  return result;
}

/* ═══════════════════════════════════════════════════════════════════════════
   主入口函数
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 消息后处理管线主入口
 *
 * 设计哲学：
 * - 管线化：将后处理拆分为独立函数，组合形成可配置管线
 * - 单一职责：每个子函数只做一件事
 * - 消除特殊情况：通过统一的数据结构减少分支判断
 *
 * 处理流程：
 * 1. None 模式：直接返回，不做任何处理
 * 2. 名称规范化：将 name 字段转为 content 前缀
 * 3. 工具处理：根据 tools 选项保留或剥离工具字段
 * 4. 角色合并：合并连续同角色消息（Single 模式合并为单条）
 * 5. 严格模式：Semi/Strict 模式的额外处理
 * 6. 空消息兜底：确保输出非空
 * 7. Prefill 应用：设置 assistant 预填充
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 *
 * @param messages - 输入消息数组
 * @param options - 后处理配置选项
 * @returns 处理后的消息数组
 */
export function postProcessMessages(
  messages: ExtendedChatMessage[],
  options: PostProcessOptions,
): ExtendedChatMessage[] {
  // ─────────────────────────────────────────────────────────────────────────
  // Step 0: None 模式 - 恒等变换
  // ─────────────────────────────────────────────────────────────────────────
  if (options.mode === PostProcessingMode.NONE) {
    return messages;
  }

  let result = [...messages];

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: 名称规范化
  // 将 name 字段转为 content 前缀，确保群聊/多角色示例正确显示
  // ─────────────────────────────────────────────────────────────────────────
  result = normalizeNames(result, options.names);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: 工具处理
  // 根据 tools 选项决定是否保留工具调用字段
  // ─────────────────────────────────────────────────────────────────────────
  if (!options.tools) {
    result = stripTools(result);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: 角色合并
  // Single 模式：所有消息合并为单条 user
  // 其他模式：合并连续同角色消息
  // ─────────────────────────────────────────────────────────────────────────
  const forceSingleUser = options.mode === PostProcessingMode.SINGLE;
  result = mergeConsecutiveRoles(result, forceSingleUser);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4: 严格模式处理
  // Semi/Strict：将中途 system 转为 user
  // Strict：确保首条非 system 消息为 user
  // ─────────────────────────────────────────────────────────────────────────
  if (
    options.mode === PostProcessingMode.SEMI ||
    options.mode === PostProcessingMode.STRICT
  ) {
    result = convertMidSystemToUser(result);
  }

  if (options.mode === PostProcessingMode.STRICT) {
    result = ensureUserStart(result, options.placeholder);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 5: 空消息兜底
  // 确保输出至少有一条消息，避免 API 请求失败
  // ─────────────────────────────────────────────────────────────────────────
  result = ensureNonEmpty(result, options.placeholder);

  // ─────────────────────────────────────────────────────────────────────────
  // Step 6: Prefill 应用
  // 设置 assistant 预填充，引导模型从特定内容开始生成
  // ─────────────────────────────────────────────────────────────────────────
  if (options.prefill) {
    result = applyPrefill(result, options.prefill, options.tools);
  }

  return result;
}
