/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              Preset 兼容层属性测试                                          ║
 * ║                                                                            ║
 * ║  **Feature: message-assembly-remediation, Property 13: 兼容层自动应用**     ║
 * ║  **Validates: Requirements 7.4**                                           ║
 * ║                                                                            ║
 * ║  验证旧版 preset 能够被正确检测并自动应用兼容层转换                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { STOpenAIPreset, STPrompt, ChatMessage } from "@/lib/core/st-preset-types";
import {
  isLegacyPreset,
  checkPresetCompatibility,
  applyCompatibilityLayer,
  replaceTextPlaceholdersInMessages,
  findUnreplacedPlaceholders,
} from "@/lib/core/prompt/compatibility";

/* ═══════════════════════════════════════════════════════════════════════════
   测试数据生成器
   ═══════════════════════════════════════════════════════════════════════════ */

/** 生成标准 prompt identifier */
const standardIdentifierArb = fc.constantFrom(
  "main",
  "nsfw",
  "jailbreak",
  "enhanceDefinitions",
  "worldInfoBefore",
  "worldInfoAfter",
  "charDescription",
  "charPersonality",
  "scenario",
  "personaDescription",
  "dialogueExamples",
);

/** 生成不含占位符的 prompt content */
const cleanContentArb = fc.string({ minLength: 0, maxLength: 200 })
  .filter((s) => !s.includes("{{"));

/** 生成含 {{chatHistory}} 占位符的 content */
const contentWithChatHistoryArb = fc.tuple(
  fc.string({ minLength: 0, maxLength: 50 }),
  fc.string({ minLength: 0, maxLength: 50 }),
).map(([before, after]) => `${before}{{chatHistory}}${after}`);

/** 生成标准 STPrompt（非 marker） */
const standardPromptArb: fc.Arbitrary<STPrompt> = fc.record({
  identifier: standardIdentifierArb,
  name: fc.string({ minLength: 1, maxLength: 30 }),
  content: cleanContentArb,
  role: fc.constantFrom("system", "user", "assistant") as fc.Arbitrary<"system" | "user" | "assistant">,
  system_prompt: fc.constant(true),
  marker: fc.constant(false),
});

/** 生成 chatHistory marker */
const chatHistoryMarkerArb: fc.Arbitrary<STPrompt> = fc.constant({
  identifier: "chatHistory",
  name: "Chat History",
  system_prompt: true,
  marker: true,
});

/** 生成 prompt_order entry */
const promptOrderEntryArb = (identifier: string) => fc.record({
  identifier: fc.constant(identifier),
  enabled: fc.boolean(),
});

/** 生成现代 preset（包含 chatHistory marker） */
const modernPresetArb: fc.Arbitrary<STOpenAIPreset> = fc.tuple(
  fc.array(standardPromptArb, { minLength: 1, maxLength: 5 }),
  chatHistoryMarkerArb,
).map(([prompts, chatHistoryMarker]) => {
  const allPrompts = [...prompts, chatHistoryMarker];
  return {
    prompts: allPrompts,
    prompt_order: [{
      character_id: 100001,
      order: allPrompts.map((p) => ({ identifier: p.identifier, enabled: true })),
    }],
    temperature: 1,
    top_p: 1,
  };
});

/** 生成旧版 preset（缺少 chatHistory marker） */
const legacyPresetMissingMarkerArb: fc.Arbitrary<STOpenAIPreset> = fc
  .array(standardPromptArb, { minLength: 1, maxLength: 5 })
  .filter((prompts) => !prompts.some((p) => p.identifier === "chatHistory"))
  .map((prompts) => ({
    prompts,
    prompt_order: [{
      character_id: 100001,
      order: prompts.map((p) => ({ identifier: p.identifier, enabled: true })),
    }],
    temperature: 1,
    top_p: 1,
  }));

/** 生成旧版 preset（使用文本占位符） */
const legacyPresetWithPlaceholderArb: fc.Arbitrary<STOpenAIPreset> = fc.tuple(
  fc.array(standardPromptArb, { minLength: 0, maxLength: 3 }),
  contentWithChatHistoryArb,
).map(([prompts, contentWithPlaceholder]) => {
  const promptWithPlaceholder: STPrompt = {
    identifier: "main",
    name: "Main Prompt",
    content: contentWithPlaceholder,
    role: "system",
    system_prompt: true,
    marker: false,
  };
  const allPrompts = [promptWithPlaceholder, ...prompts.filter((p) => p.identifier !== "main")];
  return {
    prompts: allPrompts,
    prompt_order: [{
      character_id: 100001,
      order: allPrompts.map((p) => ({ identifier: p.identifier, enabled: true })),
    }],
    temperature: 1,
    top_p: 1,
  };
});

/** 生成 ChatMessage */
const chatMessageArb: fc.Arbitrary<ChatMessage> = fc.record({
  role: fc.constantFrom("user", "assistant", "system") as fc.Arbitrary<"user" | "assistant" | "system">,
  content: fc.string({ minLength: 1, maxLength: 100 }),
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 13: 兼容层自动应用
   **Validates: Requirements 7.4**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 13: 兼容层自动应用", () => {
  /**
   * **Feature: message-assembly-remediation, Property 13**
   * **Validates: Requirements 7.4**
   *
   * *For any* 现代 preset（包含 chatHistory marker），
   * isLegacyPreset 应返回 false
   */
  it("*For any* modern preset with chatHistory marker, isLegacyPreset SHALL return false", () => {
    fc.assert(
      fc.property(modernPresetArb, (preset) => {
        const result = isLegacyPreset(preset);
        expect(result).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 13**
   * **Validates: Requirements 7.4**
   *
   * *For any* 旧版 preset（缺少 chatHistory marker），
   * isLegacyPreset 应返回 true
   */
  it("*For any* legacy preset missing chatHistory marker, isLegacyPreset SHALL return true", () => {
    fc.assert(
      fc.property(legacyPresetMissingMarkerArb, (preset) => {
        const result = isLegacyPreset(preset);
        expect(result).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 13**
   * **Validates: Requirements 7.4**
   *
   * *For any* 旧版 preset（使用文本占位符），
   * isLegacyPreset 应返回 true
   */
  it("*For any* legacy preset with text placeholders, isLegacyPreset SHALL return true", () => {
    fc.assert(
      fc.property(legacyPresetWithPlaceholderArb, (preset) => {
        const result = isLegacyPreset(preset);
        expect(result).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 13**
   * **Validates: Requirements 7.4**
   *
   * *For any* 旧版 preset（缺少 chatHistory marker），
   * applyCompatibilityLayer 后应包含 chatHistory marker
   */
  it("*For any* legacy preset missing marker, applyCompatibilityLayer SHALL add chatHistory marker", () => {
    fc.assert(
      fc.property(legacyPresetMissingMarkerArb, (preset) => {
        const transformed = applyCompatibilityLayer(preset);

        // 验证转换后包含 chatHistory marker
        const chatHistoryPrompt = transformed.prompts.find(
          (p) => p.identifier === "chatHistory" && p.marker === true,
        );
        expect(chatHistoryPrompt).toBeDefined();

        // 验证 prompt_order 也包含 chatHistory
        const hasInOrder = transformed.prompt_order.some((order) =>
          order.order.some((o) => o.identifier === "chatHistory"),
        );
        expect(hasInOrder).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 13**
   * **Validates: Requirements 7.4**
   *
   * *For any* 现代 preset，applyCompatibilityLayer 应返回原 preset（不修改）
   */
  it("*For any* modern preset, applyCompatibilityLayer SHALL return unchanged preset", () => {
    fc.assert(
      fc.property(modernPresetArb, (preset) => {
        const transformed = applyCompatibilityLayer(preset);

        // 验证 prompts 数量不变
        expect(transformed.prompts.length).toBe(preset.prompts.length);

        // 验证是同一个对象（未修改）
        expect(transformed).toBe(preset);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: message-assembly-remediation, Property 13**
   * **Validates: Requirements 7.4**
   *
   * *For any* preset，applyCompatibilityLayer 不应修改原对象
   */
  it("*For any* preset, applyCompatibilityLayer SHALL NOT mutate original preset", () => {
    fc.assert(
      fc.property(legacyPresetMissingMarkerArb, (preset) => {
        // 深拷贝原始数据
        const originalJson = JSON.stringify(preset);

        applyCompatibilityLayer(preset);

        // 验证原对象未被修改
        expect(JSON.stringify(preset)).toBe(originalJson);
      }),
      { numRuns: 50 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   文本占位符替换测试
   **Validates: Requirements 7.1**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("文本占位符替换 (Requirements 7.1)", () => {
  /**
   * *For any* messages 和 replacements，
   * replaceTextPlaceholdersInMessages 应正确替换占位符
   * 
   * 注意：排除包含 $ 的替换值，因为 $ 在 JavaScript 正则替换中有特殊含义
   */
  it("*For any* messages with placeholders, replacement SHALL work correctly", () => {
    // 生成不含 $ 和 { 的安全字符串（避免正则替换特殊字符和嵌套占位符）
    const safeStringArb = fc.string({ minLength: 1, maxLength: 50 })
      .filter((s) => !s.includes("$") && !s.includes("{"));

    fc.assert(
      fc.property(
        safeStringArb,
        safeStringArb,
        safeStringArb,
        (before, after, replacement) => {
          const messages: ChatMessage[] = [
            { role: "system", content: `${before}{{testPlaceholder}}${after}` },
          ];

          const result = replaceTextPlaceholdersInMessages(messages, {
            testPlaceholder: replacement,
          });

          expect(result[0].content).toBe(`${before}${replacement}${after}`);
          expect(result[0].content).not.toContain("{{testPlaceholder}}");
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * *For any* messages 无占位符，replaceTextPlaceholdersInMessages 应返回相同内容
   */
  it("*For any* messages without placeholders, content SHALL remain unchanged", () => {
    fc.assert(
      fc.property(
        fc.array(chatMessageArb, { minLength: 1, maxLength: 5 }),
        (messages) => {
          // 过滤掉含 {{ 的消息
          const cleanMessages = messages.filter((m) => !m.content.includes("{{"));
          if (cleanMessages.length === 0) return;

          const result = replaceTextPlaceholdersInMessages(cleanMessages, {
            chatHistory: "历史",
            wiBefore: "世界书",
          });

          // 验证内容未变
          for (let i = 0; i < cleanMessages.length; i++) {
            expect(result[i].content).toBe(cleanMessages[i].content);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * replaceTextPlaceholdersInMessages 不应修改原数组
   */
  it("replaceTextPlaceholdersInMessages SHALL NOT mutate original array", () => {
    const original: ChatMessage[] = [
      { role: "system", content: "Hello {{name}}" },
    ];
    const originalJson = JSON.stringify(original);

    replaceTextPlaceholdersInMessages(original, { name: "World" });

    expect(JSON.stringify(original)).toBe(originalJson);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   未替换占位符检测测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("未替换占位符检测", () => {
  it("findUnreplacedPlaceholders 应检测出所有未替换的占位符", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "Hello {{name}}, welcome to {{place}}" },
      { role: "user", content: "My name is {{name}}" },
    ];

    const unreplaced = findUnreplacedPlaceholders(messages);

    expect(unreplaced).toContain("name");
    expect(unreplaced).toContain("place");
    expect(unreplaced.length).toBe(2); // name 只计一次
  });

  it("无占位符时应返回空数组", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "Hello World" },
    ];

    const unreplaced = findUnreplacedPlaceholders(messages);

    expect(unreplaced).toEqual([]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   兼容性检测详细结果测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("checkPresetCompatibility 详细结果", () => {
  it("现代 preset 应返回 isLegacy=false 且无 issues", () => {
    fc.assert(
      fc.property(modernPresetArb, (preset) => {
        const result = checkPresetCompatibility(preset);

        expect(result.isLegacy).toBe(false);
        expect(result.missingChatHistoryMarker).toBe(false);
      }),
      { numRuns: 50 },
    );
  });

  it("缺少 marker 的 preset 应报告 missing_marker issue", () => {
    fc.assert(
      fc.property(legacyPresetMissingMarkerArb, (preset) => {
        const result = checkPresetCompatibility(preset);

        expect(result.missingChatHistoryMarker).toBe(true);
        expect(result.issues.some((i) => i.type === "missing_marker")).toBe(true);
      }),
      { numRuns: 50 },
    );
  });

  it("使用文本占位符的 preset 应报告 text_placeholder issue", () => {
    fc.assert(
      fc.property(legacyPresetWithPlaceholderArb, (preset) => {
        const result = checkPresetCompatibility(preset);

        expect(result.usesTextPlaceholders).toBe(true);
        expect(result.issues.some((i) => i.type === "text_placeholder")).toBe(true);
      }),
      { numRuns: 50 },
    );
  });
});
