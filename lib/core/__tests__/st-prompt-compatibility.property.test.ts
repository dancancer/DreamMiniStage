/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║           STPromptManager ST 兼容性属性测试                                 ║
 * ║                                                                            ║
 * ║  **Feature: st-prompt-compatibility**                                      ║
 * ║  验证与 SillyTavern 原版实现的语义兼容性                                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { createPromptManagerFromOpenAI } from "@/lib/core/prompt";
import { STMacroEvaluator } from "@/lib/core/st-macro-evaluator";
import type {
  MacroEnv,
  STOpenAIPreset,
  STPrompt,
  GenerationType,
  STInjectionTrigger,
  ChatMessage,
} from "@/lib/core/st-preset-types";

/* ═══════════════════════════════════════════════════════════════════════════
   生成器定义
   ═══════════════════════════════════════════════════════════════════════════ */

/** 所有有效的 GenerationType 值 */
const ALL_GENERATION_TYPES: GenerationType[] = [
  "normal", "continue", "quiet", "impersonate", "swipe", "regenerate", "group",
];

/** 生成单个 GenerationType */
const generationTypeArb = fc.constantFrom(...ALL_GENERATION_TYPES);

/** 生成 GenerationType 数组（可能为空） */
const generationTypeArrayArb = fc.array(generationTypeArb, { minLength: 0, maxLength: 7 });

/** 生成非空 GenerationType 数组 */
const nonEmptyGenerationTypeArrayArb = fc.array(generationTypeArb, { minLength: 1, maxLength: 7 });

/* ═══════════════════════════════════════════════════════════════════════════
   测试工具
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 创建带有指定 trigger 的 preset
 */
function createPresetWithTrigger(
  trigger: STInjectionTrigger | STInjectionTrigger[] | undefined,
): STOpenAIPreset {
  const prompt: STPrompt = {
    identifier: "testPrompt",
    name: "Test Prompt",
    system_prompt: true,
    role: "system",
    content: "Test content",
    injection_trigger: trigger,
  };

  return {
    prompts: [prompt],
    prompt_order: [{
      character_id: 100001,
      order: [{ identifier: "testPrompt", enabled: true }],
    }],
    temperature: 1,
    squash_system_messages: false,
  };
}

/**
 * 创建基础 MacroEnv
 */
function createBaseEnv(): MacroEnv {
  return { user: "User", char: "Assistant" };
}

/**
 * 检查 prompt 是否在给定 generationType 下被启用
 */
function isPromptEnabled(
  trigger: STInjectionTrigger | STInjectionTrigger[] | undefined,
  generationType: GenerationType,
): boolean {
  const preset = createPresetWithTrigger(trigger);
  const manager = createPromptManagerFromOpenAI(preset, undefined, new STMacroEvaluator());
  const messages = manager.buildMessages(createBaseEnv(), { generationType });
  return messages.some(m => m.content === "Test content");
}

/* ═══════════════════════════════════════════════════════════════════════════
   Property 1: Trigger 匹配正确性
   **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 1: Trigger 匹配正确性", () => {
  /**
   * **Feature: st-prompt-compatibility, Property 1: Trigger 匹配正确性**
   * **Validates: Requirements 1.4**
   *
   * *For any* generationType，当 prompt 没有 injection_trigger 时，
   * 该 prompt 应该对所有生成类型都启用
   */
  it("1.4: undefined trigger → 所有类型都启用", () => {
    fc.assert(
      fc.property(generationTypeArb, (genType) => {
        const enabled = isPromptEnabled(undefined, genType);
        expect(enabled).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: st-prompt-compatibility, Property 1: Trigger 匹配正确性**
   * **Validates: Requirements 1.3**
   *
   * *For any* generationType，当 prompt 的 injection_trigger 为空数组时，
   * 该 prompt 应该对所有生成类型都启用
   */
  it("1.3: 空数组 trigger → 所有类型都启用", () => {
    fc.assert(
      fc.property(generationTypeArb, (genType) => {
        const enabled = isPromptEnabled([], genType);
        expect(enabled).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: st-prompt-compatibility, Property 1: Trigger 匹配正确性**
   * **Validates: Requirements 1.2**
   *
   * *For any* trigger (string) 和 generationType，
   * 当 trigger === generationType 时启用，否则禁用
   */
  it("1.2: 单值 string trigger → 仅匹配时启用", () => {
    fc.assert(
      fc.property(generationTypeArb, generationTypeArb, (trigger, genType) => {
        const enabled = isPromptEnabled(trigger, genType);
        const expected = trigger === genType;
        expect(enabled).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: st-prompt-compatibility, Property 1: Trigger 匹配正确性**
   * **Validates: Requirements 1.1**
   *
   * *For any* trigger (非空数组) 和 generationType，
   * 当 generationType 在数组中时启用，否则禁用
   */
  it("1.1: 非空数组 trigger → 包含时启用", () => {
    fc.assert(
      fc.property(nonEmptyGenerationTypeArrayArb, generationTypeArb, (triggerArray, genType) => {
        const enabled = isPromptEnabled(triggerArray, genType);
        const expected = triggerArray.includes(genType);
        expect(enabled).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  /* ─────────────────────────────────────────────────────────────────────────
     边界情况
     ───────────────────────────────────────────────────────────────────────── */

  it("单元素数组等价于单值 string", () => {
    fc.assert(
      fc.property(generationTypeArb, generationTypeArb, (trigger, genType) => {
        const singleEnabled = isPromptEnabled(trigger, genType);
        const arrayEnabled = isPromptEnabled([trigger], genType);
        expect(arrayEnabled).toBe(singleEnabled);
      }),
      { numRuns: 100 },
    );
  });

  it("重复元素数组与去重数组行为一致", () => {
    fc.assert(
      fc.property(generationTypeArb, generationTypeArb, (trigger, genType) => {
        const singleEnabled = isPromptEnabled([trigger], genType);
        const duplicateEnabled = isPromptEnabled([trigger, trigger, trigger], genType);
        expect(duplicateEnabled).toBe(singleEnabled);
      }),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 2: Absolute Injection 排序正确性
   **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   ═══════════════════════════════════════════════════════════════════════════ */

/** role 类型 */
type MessageRole = "system" | "user" | "assistant";
const ALL_ROLES: MessageRole[] = ["system", "user", "assistant"];

/** 生成 role */
const roleArb = fc.constantFrom<MessageRole>(...ALL_ROLES);

/** 生成 depth (0-10) */
const depthArb = fc.integer({ min: 0, max: 10 });

/** 生成 order (0-1000) */
const orderArb = fc.integer({ min: 0, max: 1000 });

/** 生成单个 absolute injection 配置 */
const absoluteInjectionConfigArb = fc.record({
  depth: depthArb,
  order: orderArb,
  role: roleArb,
  id: fc.uuid(),
});

/** 生成多个 absolute injection 配置 */
const absoluteInjectionsArb = fc.array(absoluteInjectionConfigArb, { minLength: 1, maxLength: 10 });

/**
 * 创建带有 absolute injection prompts 的 preset
 */
function createPresetWithAbsoluteInjections(
  injections: Array<{ depth: number; order: number; role: MessageRole; id: string }>,
): STOpenAIPreset {
  const prompts: STPrompt[] = injections.map((inj, idx) => ({
    identifier: `abs_${idx}_${inj.id}`,
    name: `Absolute ${idx}`,
    system_prompt: inj.role === "system",
    role: inj.role,
    content: `[D${inj.depth}O${inj.order}R${inj.role}]`,
    injection_position: 1,
    injection_depth: inj.depth,
    injection_order: inj.order,
  }));

  // 添加 chatHistory marker 作为基础消息
  prompts.push({
    identifier: "chatHistory",
    name: "Chat History",
    system_prompt: false,
    marker: true,
  });

  return {
    prompts,
    prompt_order: [{
      character_id: 100001,
      order: [
        { identifier: "chatHistory", enabled: true },
        ...injections.map((_, idx) => ({
          identifier: `abs_${idx}_${injections[idx].id}`,
          enabled: true,
        })),
      ],
    }],
    temperature: 1,
    squash_system_messages: false,
  };
}

/**
 * 从消息内容解析 injection 元数据
 */
function parseInjectionMeta(content: string): { depth: number; order: number; role: string } | null {
  const match = content.match(/\[D(\d+)O(\d+)R(\w+)\]/);
  if (!match) return null;
  return { depth: parseInt(match[1]), order: parseInt(match[2]), role: match[3] };
}

/**
 * 验证两个 injection 的排序是否正确
 * 返回 true 表示 a 应该在 b 之前（或相等）
 */
function shouldAppearBefore(
  a: { depth: number; order: number; role: string },
  b: { depth: number; order: number; role: string },
): boolean {
  const rolePriority: Record<string, number> = { system: 0, user: 1, assistant: 2 };

  // 高 depth 先处理，但因为是从末尾插入，所以高 depth 的消息会在数组前面
  if (a.depth !== b.depth) return a.depth > b.depth;
  // 同 depth，高 order 先插入
  if (a.order !== b.order) return a.order > b.order;
  // 同 depth/order，system > user > assistant
  return (rolePriority[a.role] ?? 3) <= (rolePriority[b.role] ?? 3);
}

describe("Property 2: Absolute Injection 排序正确性", () => {
  /**
   * **Feature: st-prompt-compatibility, Property 2: Absolute Injection 排序正确性**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   *
   * *For any* set of absolute injections with varying depth/order/role,
   * the final message order should satisfy the ST sorting rules
   */
  it("2.1-2.4: depth desc → order desc → role priority", () => {
    fc.assert(
      fc.property(absoluteInjectionsArb, (injections) => {
        const preset = createPresetWithAbsoluteInjections(injections);
        const manager = createPromptManagerFromOpenAI(preset, undefined, new STMacroEvaluator());

        // 提供基础聊天历史
        const env: MacroEnv = {
          user: "User",
          char: "Assistant",
          chatHistoryMessages: [
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi there" },
          ],
        };

        const messages = manager.buildMessages(env, {});

        // 提取所有 injection 消息（排除基础历史消息）
        const injectedMessages = messages.filter(
          (m: ChatMessage) => m.content.startsWith("[D"),
        );

        // 解析元数据
        const parsedInjections = injectedMessages
          .map((m: ChatMessage) => parseInjectionMeta(m.content))
          .filter((meta): meta is NonNullable<typeof meta> => meta !== null);

        // 验证排序：每对相邻消息都应满足排序规则
        for (let i = 0; i < parsedInjections.length - 1; i++) {
          const current = parsedInjections[i];
          const next = parsedInjections[i + 1];

          // current 应该在 next 之前（或相等）
          const isCorrectOrder = shouldAppearBefore(current, next);
          expect(isCorrectOrder).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: st-prompt-compatibility, Property 2: Absolute Injection 排序正确性**
   * **Validates: Requirements 2.1**
   *
   * 同 depth 内，高 order 的消息应该先出现
   */
  it("2.1: 同 depth 内，高 order 先出现", () => {
    fc.assert(
      fc.property(
        depthArb,
        fc.array(orderArb, { minLength: 2, maxLength: 5 }),
        (depth, orders) => {
          // 创建同 depth 不同 order 的 injections
          const injections = orders.map((order, idx) => ({
            depth,
            order,
            role: "system" as MessageRole,
            id: `test-${idx}`,
          }));

          const preset = createPresetWithAbsoluteInjections(injections);
          const manager = createPromptManagerFromOpenAI(preset, undefined, new STMacroEvaluator());

          const env: MacroEnv = {
            user: "User",
            char: "Assistant",
            chatHistoryMessages: [{ role: "user", content: "Hello" }],
          };

          const messages = manager.buildMessages(env, {});
          const injectedMessages = messages.filter(
            (m: ChatMessage) => m.content.startsWith("[D"),
          );

          // 提取 order 值
          const extractedOrders = injectedMessages
            .map((m: ChatMessage) => parseInjectionMeta(m.content)?.order)
            .filter((o): o is number => o !== undefined);

          // 验证 order 降序
          for (let i = 0; i < extractedOrders.length - 1; i++) {
            expect(extractedOrders[i]).toBeGreaterThanOrEqual(extractedOrders[i + 1]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: st-prompt-compatibility, Property 2: Absolute Injection 排序正确性**
   * **Validates: Requirements 2.2**
   *
   * 同 depth/order 内，role 优先级：system > user > assistant
   */
  it("2.2: 同 depth/order 内，system > user > assistant", () => {
    fc.assert(
      fc.property(depthArb, orderArb, (depth, order) => {
        // 创建同 depth/order 不同 role 的 injections
        const injections: Array<{ depth: number; order: number; role: MessageRole; id: string }> = [
          { depth, order, role: "assistant", id: "assistant" },
          { depth, order, role: "user", id: "user" },
          { depth, order, role: "system", id: "system" },
        ];

        const preset = createPresetWithAbsoluteInjections(injections);
        const manager = createPromptManagerFromOpenAI(preset, undefined, new STMacroEvaluator());

        const env: MacroEnv = {
          user: "User",
          char: "Assistant",
          chatHistoryMessages: [{ role: "user", content: "Hello" }],
        };

        const messages = manager.buildMessages(env, {});
        const injectedMessages = messages.filter(
          (m: ChatMessage) => m.content.startsWith("[D"),
        );

        // 提取 role 值
        const extractedRoles = injectedMessages
          .map((m: ChatMessage) => parseInjectionMeta(m.content)?.role)
          .filter((r): r is string => r !== undefined);

        // 验证 role 顺序：system 应该在 user 之前，user 应该在 assistant 之前
        const systemIdx = extractedRoles.indexOf("system");
        const userIdx = extractedRoles.indexOf("user");
        const assistantIdx = extractedRoles.indexOf("assistant");

        if (systemIdx !== -1 && userIdx !== -1) {
          expect(systemIdx).toBeLessThan(userIdx);
        }
        if (userIdx !== -1 && assistantIdx !== -1) {
          expect(userIdx).toBeLessThan(assistantIdx);
        }
        if (systemIdx !== -1 && assistantIdx !== -1) {
          expect(systemIdx).toBeLessThan(assistantIdx);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: st-prompt-compatibility, Property 2: Absolute Injection 排序正确性**
   * **Validates: Requirements 2.4**
   *
   * 高 depth 的消息应该在数组前面（因为从末尾倒数插入）
   */
  it("2.4: 高 depth 的消息在数组前面", () => {
    fc.assert(
      fc.property(
        fc.array(depthArb, { minLength: 2, maxLength: 5 }),
        (depths) => {
          // 创建不同 depth 的 injections，order 相同
          const injections = depths.map((depth, idx) => ({
            depth,
            order: 100,
            role: "system" as MessageRole,
            id: `test-${idx}`,
          }));

          const preset = createPresetWithAbsoluteInjections(injections);
          const manager = createPromptManagerFromOpenAI(preset, undefined, new STMacroEvaluator());

          const env: MacroEnv = {
            user: "User",
            char: "Assistant",
            chatHistoryMessages: Array(15).fill(null).map((_, i) => ({
              role: i % 2 === 0 ? "user" : "assistant",
              content: `Message ${i}`,
            })) as ChatMessage[],
          };

          const messages = manager.buildMessages(env, {});
          const injectedMessages = messages.filter(
            (m: ChatMessage) => m.content.startsWith("[D"),
          );

          // 提取 depth 值
          const extractedDepths = injectedMessages
            .map((m: ChatMessage) => parseInjectionMeta(m.content)?.depth)
            .filter((d): d is number => d !== undefined);

          // 验证 depth 降序（高 depth 在前）
          for (let i = 0; i < extractedDepths.length - 1; i++) {
            expect(extractedDepths[i]).toBeGreaterThanOrEqual(extractedDepths[i + 1]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   辅助生成器
   ═══════════════════════════════════════════════════════════════════════════ */

/** 生成非空消息内容 */
const nonEmptyContentArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

/** 生成 name 字段 */
const nameArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0);

/* ═══════════════════════════════════════════════════════════════════════════
   Property 5: Marker Env 回退
   **Validates: Requirements 4.2, 4.4**
   ═══════════════════════════════════════════════════════════════════════════ */

/** 硬编码 markerMap 中的标准 identifier */
const STANDARD_MARKER_IDENTIFIERS = [
  "worldInfoBefore",
  "worldInfoAfter",
  "charDescription",
  "charPersonality",
  "scenario",
  "personaDescription",
  "dialogueExamples",
  "chatHistory",
];

/** JavaScript 原型链上的特殊属性名（需要排除） */
const JS_PROTOTYPE_PROPERTIES = [
  "__proto__", "constructor", "prototype",
  "toString", "valueOf", "hasOwnProperty",
  "isPrototypeOf", "propertyIsEnumerable",
  "toLocaleString", "__defineGetter__", "__defineSetter__",
  "__lookupGetter__", "__lookupSetter__",
];

/** 生成非标准 marker identifier（不在 markerMap 中） */
const customMarkerIdentifierArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => {
    const trimmed = s.trim();
    return trimmed.length > 0 &&
           !STANDARD_MARKER_IDENTIFIERS.includes(trimmed) &&
           // 排除可能冲突的标准字段
           !["user", "char", "userInput"].includes(trimmed) &&
           // 排除 JavaScript 原型链上的特殊属性名
           !JS_PROTOTYPE_PROPERTIES.includes(trimmed);
  });

/** 生成非空 marker 内容 */
const markerContentArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

/**
 * 创建带有自定义 marker 的 preset
 */
function createPresetWithCustomMarker(identifier: string): STOpenAIPreset {
  return {
    prompts: [{
      identifier,
      name: `Custom Marker: ${identifier}`,
      system_prompt: true,
      role: "system",
      marker: true,
    }],
    prompt_order: [{
      character_id: 100001,
      order: [{ identifier, enabled: true }],
    }],
    temperature: 1,
    squash_system_messages: false,
  };
}

describe("Property 5: Marker Env 回退", () => {
  /**
   * **Feature: st-prompt-compatibility, Property 5: Marker Env 回退**
   * **Validates: Requirements 4.2**
   *
   * *For any* marker identifier not in hardcoded markerMap,
   * if env[identifier] has a string value, that value should be used as marker content
   */
  it("4.2: 自定义 marker 从 env[identifier] 获取内容", () => {
    fc.assert(
      fc.property(customMarkerIdentifierArb, markerContentArb, (identifier, content) => {
        const preset = createPresetWithCustomMarker(identifier);
        const manager = createPromptManagerFromOpenAI(preset, undefined, new STMacroEvaluator());

        // 在 env 中设置自定义 marker 的值
        const env: MacroEnv = {
          user: "User",
          char: "Assistant",
          [identifier]: content,
        };

        const messages = manager.buildMessages(env, {});

        // 应该有一条消息，内容为 env[identifier] 的值
        expect(messages.length).toBe(1);
        expect(messages[0].content).toBe(content);
        expect(messages[0].role).toBe("system");
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: st-prompt-compatibility, Property 5: Marker Env 回退**
   * **Validates: Requirements 4.4**
   *
   * *For any* new marker identifier added to a preset,
   * the system should resolve it via env without code changes
   */
  it("4.4: 新 marker 无需代码修改即可工作", () => {
    fc.assert(
      fc.property(
        customMarkerIdentifierArb,
        markerContentArb,
        fc.array(fc.tuple(customMarkerIdentifierArb, markerContentArb), { minLength: 0, maxLength: 3 }),
        (mainId, mainContent, extraMarkers) => {
          // 确保所有 identifier 唯一
          const allIds = new Set([mainId, ...extraMarkers.map(([id]) => id)]);
          if (allIds.size !== 1 + extraMarkers.length) return; // 跳过重复 id 的情况

          // 创建带有多个自定义 marker 的 preset
          const prompts: STPrompt[] = [
            {
              identifier: mainId,
              name: `Marker: ${mainId}`,
              system_prompt: true,
              role: "system",
              marker: true,
            },
            ...extraMarkers.map(([id]) => ({
              identifier: id,
              name: `Marker: ${id}`,
              system_prompt: true,
              role: "system" as const,
              marker: true,
            })),
          ];

          const preset: STOpenAIPreset = {
            prompts,
            prompt_order: [{
              character_id: 100001,
              order: prompts.map(p => ({ identifier: p.identifier, enabled: true })),
            }],
            temperature: 1,
            squash_system_messages: false,
          };

          const manager = createPromptManagerFromOpenAI(preset, undefined, new STMacroEvaluator());

          // 在 env 中设置所有 marker 的值
          const env: MacroEnv = {
            user: "User",
            char: "Assistant",
            [mainId]: mainContent,
            ...Object.fromEntries(extraMarkers),
          };

          const messages = manager.buildMessages(env, {});

          // 所有 marker 都应该被解析
          expect(messages.length).toBe(1 + extraMarkers.length);

          // 验证主 marker 内容
          expect(messages[0].content).toBe(mainContent);

          // 验证额外 marker 内容
          for (let i = 0; i < extraMarkers.length; i++) {
            expect(messages[i + 1].content).toBe(extraMarkers[i][1]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: st-prompt-compatibility, Property 5: Marker Env 回退**
   * **Validates: Requirements 4.3**
   *
   * 当 marker 解析为空或 undefined 时，应该跳过该 prompt
   */
  it("4.3: 空/undefined marker 被跳过", () => {
    fc.assert(
      fc.property(customMarkerIdentifierArb, (identifier) => {
        const preset = createPresetWithCustomMarker(identifier);
        const manager = createPromptManagerFromOpenAI(preset, undefined, new STMacroEvaluator());

        // env 中不设置该 identifier 的值
        const env: MacroEnv = {
          user: "User",
          char: "Assistant",
        };

        const messages = manager.buildMessages(env, {});

        // 应该没有消息（marker 解析为空被跳过）
        expect(messages.length).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: st-prompt-compatibility, Property 5: Marker Env 回退**
   * **Validates: Requirements 4.1**
   *
   * 标准 marker 优先使用 markerMap（不受 env 同名字段影响）
   */
  it("4.1: 标准 marker 优先使用 markerMap", () => {
    // 测试 worldInfoBefore 这个标准 marker
    const preset: STOpenAIPreset = {
      prompts: [{
        identifier: "worldInfoBefore",
        name: "World Info Before",
        system_prompt: true,
        role: "system",
        marker: true,
      }],
      prompt_order: [{
        character_id: 100001,
        order: [{ identifier: "worldInfoBefore", enabled: true }],
      }],
      temperature: 1,
      squash_system_messages: false,
    };

    fc.assert(
      fc.property(markerContentArb, (wiBeforeContent) => {
        const manager = createPromptManagerFromOpenAI(preset, undefined, new STMacroEvaluator());

        // 通过 wiBefore 字段设置值（标准映射）
        const env: MacroEnv = {
          user: "User",
          char: "Assistant",
          wiBefore: wiBeforeContent,
        };

        const messages = manager.buildMessages(env, {});

        // 应该使用 wiBefore 的值
        expect(messages.length).toBe(1);
        expect(messages[0].content).toBe(wiBeforeContent);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: st-prompt-compatibility, Property 5: Marker Env 回退**
   * **Validates: Requirements 4.2**
   *
   * 非字符串类型的 env 值应该被忽略（返回空字符串）
   */
  it("非字符串 env 值被忽略", () => {
    fc.assert(
      fc.property(
        customMarkerIdentifierArb,
        fc.oneof(
          fc.integer(),
          fc.boolean(),
          fc.constant(undefined),
          fc.constant(null),
        ),
        (identifier, nonStringValue) => {
          const preset = createPresetWithCustomMarker(identifier);
          const manager = createPromptManagerFromOpenAI(preset, undefined, new STMacroEvaluator());

          // 设置非字符串值
          const env: MacroEnv = {
            user: "User",
            char: "Assistant",
            [identifier]: nonStringValue as unknown as string,
          };

          const messages = manager.buildMessages(env, {});

          // 非字符串值应该被忽略，marker 被跳过
          expect(messages.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 6: Name 保留
   **Validates: Requirements 5.1, 5.2, 5.3**
   ═══════════════════════════════════════════════════════════════════════════ */

/** 生成有效的 name 字段（非空字符串） */
const validNameArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => s.trim().length > 0);

/**
 * 生成在宏展开与模板噪声清理后仍保留内容的字符串
 *
 * Property 6 断言的是 name 保留，而不是空内容过滤。
 * 像 `${ }` 这类输入虽然原始字符串非空，但经 STMacroEvaluator 清理后会变成空串，
 * PromptManager 会按设计直接跳过该消息。
 */
const renderableContentArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter((content) => content.trim().length > 0)
  .filter((content) => {
    const evaluator = new STMacroEvaluator();
    return evaluator.evaluate(content, createBaseEnv()).trim().length > 0;
  });

/** 生成可选的 name 字段（undefined 或有效字符串） */
const optionalNameArb = fc.option(validNameArb, { nil: undefined });

/**
 * 创建带有 name 字段的 prompt preset
 */
function createPresetWithName(name: string | undefined, content: string): STOpenAIPreset {
  const prompt: STPrompt = {
    identifier: "testPrompt",
    name: name || "Test Prompt",
    system_prompt: true,
    role: "system",
    content,
  };

  // 只有当 name 存在时才设置到 prompt 上
  // 注意：STPrompt.name 是必需字段（显示名称），但我们测试的是它是否被输出到 ChatMessage.name
  // 根据实现，prompt.name 会被输出到 ChatMessage.name

  return {
    prompts: [prompt],
    prompt_order: [{
      character_id: 100001,
      order: [{ identifier: "testPrompt", enabled: true }],
    }],
    temperature: 1,
    squash_system_messages: false,
  };
}

/**
 * 创建带有可选 name 字段的 prompt preset（用于测试无 name 情况）
 */
function createPresetWithOptionalName(
  hasName: boolean,
  nameValue: string,
  content: string,
): STOpenAIPreset {
  const prompt: STPrompt = {
    identifier: "testPrompt",
    // STPrompt.name 是必需字段，但我们可以设置为空字符串来测试"无 name"情况
    // 实际上，根据实现，只有当 prompt.name 为 truthy 时才会输出到 ChatMessage.name
    name: hasName ? nameValue : "",
    system_prompt: true,
    role: "system",
    content,
  };

  return {
    prompts: [prompt],
    prompt_order: [{
      character_id: 100001,
      order: [{ identifier: "testPrompt", enabled: true }],
    }],
    temperature: 1,
    squash_system_messages: false,
  };
}

describe("Property 6: Name 保留", () => {
  /**
   * **Feature: st-prompt-compatibility, Property 6: Name 保留**
   * **Validates: Requirements 5.1**
   *
   * *For any* prompt with name field,
   * the output ChatMessage should include the same name
   */
  it("5.1: 有 name 字段的 prompt → 输出消息包含相同 name", () => {
    fc.assert(
      fc.property(validNameArb, renderableContentArb, (name, content) => {
        const preset = createPresetWithName(name, content);
        const manager = createPromptManagerFromOpenAI(preset, undefined, new STMacroEvaluator());

        const env: MacroEnv = { user: "User", char: "Assistant" };
        const messages = manager.buildMessages(env, {});

        // 应该有一条消息
        expect(messages.length).toBe(1);
        // 消息应该包含 name 字段
        expect(messages[0].name).toBe(name);
        // 内容应该正确
        expect(messages[0].content).toBe(content);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: st-prompt-compatibility, Property 6: Name 保留**
   * **Validates: Requirements 5.2**
   *
   * *For any* prompt without name field (empty string),
   * the output ChatMessage should not have name field
   */
  it("5.2: 无 name 字段的 prompt → 输出消息不包含 name", () => {
    fc.assert(
      fc.property(renderableContentArb, (content) => {
        const preset = createPresetWithOptionalName(false, "", content);
        const manager = createPromptManagerFromOpenAI(preset, undefined, new STMacroEvaluator());

        const env: MacroEnv = { user: "User", char: "Assistant" };
        const messages = manager.buildMessages(env, {});

        // 应该有一条消息
        expect(messages.length).toBe(1);
        // 消息不应该包含 name 字段（或为 undefined/空）
        expect(messages[0].name).toBeFalsy();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: st-prompt-compatibility, Property 6: Name 保留**
   * **Validates: Requirements 5.3**
   *
   * *For any* chat history messages with name field,
   * the name field should be preserved in output
   */
  it("5.3: chatHistoryMessages 中的 name 字段被保留", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            role: fc.constantFrom<"user" | "assistant">("user", "assistant"),
            content: nonEmptyContentArb,
            name: optionalNameArb,
          }),
          { minLength: 1, maxLength: 5 },
        ),
        (historyMessages) => {
          // 创建只有 chatHistory marker 的 preset
          const preset: STOpenAIPreset = {
            prompts: [{
              identifier: "chatHistory",
              name: "Chat History",
              system_prompt: false,
              marker: true,
            }],
            prompt_order: [{
              character_id: 100001,
              order: [{ identifier: "chatHistory", enabled: true }],
            }],
            temperature: 1,
            squash_system_messages: false,
          };

          const manager = createPromptManagerFromOpenAI(preset, undefined, new STMacroEvaluator());

          const env: MacroEnv = {
            user: "User",
            char: "Assistant",
            chatHistoryMessages: historyMessages as ChatMessage[],
            userInput: "", // 避免额外消息
          };

          const messages = manager.buildMessages(env, {});

          // 验证每条历史消息的 name 字段被保留
          expect(messages.length).toBe(historyMessages.length);
          for (let i = 0; i < historyMessages.length; i++) {
            const input = historyMessages[i];
            const output = messages[i];
            expect(output.content).toBe(input.content);
            expect(output.role).toBe(input.role);
            // name 字段应该被保留（如果存在）
            if (input.name) {
              expect(output.name).toBe(input.name);
            } else {
              expect(output.name).toBeFalsy();
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: st-prompt-compatibility, Property 6: Name 保留**
   * **Validates: Requirements 5.1, 5.2**
   *
   * marker prompt 的 name 字段也应该被保留
   */
  it("marker prompt 的 name 字段被保留", () => {
    fc.assert(
      fc.property(validNameArb, markerContentArb, (name, wiContent) => {
        // 创建带 name 的 worldInfoBefore marker
        const preset: STOpenAIPreset = {
          prompts: [{
            identifier: "worldInfoBefore",
            name, // 设置 name
            system_prompt: true,
            role: "system",
            marker: true,
          }],
          prompt_order: [{
            character_id: 100001,
            order: [{ identifier: "worldInfoBefore", enabled: true }],
          }],
          temperature: 1,
          squash_system_messages: false,
        };

        const manager = createPromptManagerFromOpenAI(preset, undefined, new STMacroEvaluator());

        const env: MacroEnv = {
          user: "User",
          char: "Assistant",
          wiBefore: wiContent,
        };

        const messages = manager.buildMessages(env, {});

        // 应该有一条消息
        expect(messages.length).toBe(1);
        // 消息应该包含 name 字段
        expect(messages[0].name).toBe(name);
        expect(messages[0].content).toBe(wiContent);
      }),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Property 7: Identifier 附加
   **Validates: Requirements 6.1**
   ═══════════════════════════════════════════════════════════════════════════ */

/** 生成有效的 identifier（非空字符串，不含特殊字符） */
const validIdentifierArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => {
    const trimmed = s.trim();
    return trimmed.length > 0 &&
           !JS_PROTOTYPE_PROPERTIES.includes(trimmed) &&
           // 排除标准 marker identifiers（它们有特殊处理）
           !STANDARD_MARKER_IDENTIFIERS.includes(trimmed);
  });

/**
 * 创建带有 identifier 的 prompt preset
 */
function createPresetWithIdentifier(identifier: string, content: string): STOpenAIPreset {
  return {
    prompts: [{
      identifier,
      name: `Prompt: ${identifier}`,
      system_prompt: true,
      role: "system",
      content,
    }],
    prompt_order: [{
      character_id: 100001,
      order: [{ identifier, enabled: true }],
    }],
    temperature: 1,
    squash_system_messages: false,
  };
}

describe("Property 7: Identifier 附加", () => {
  /**
   * **Feature: st-prompt-compatibility, Property 7: Identifier 附加**
   * **Validates: Requirements 6.1**
   *
   * *For any* prompt with identifier,
   * the output ChatMessage should include identifier as metadata
   *
   * 注意：identifier 是内部元数据，用于调试追踪
   */
  it("6.1: prompt 的 identifier 被附加到输出消息", () => {
    fc.assert(
      fc.property(validIdentifierArb, nonEmptyContentArb, (identifier, content) => {
        const preset = createPresetWithIdentifier(identifier, content);
        const manager = createPromptManagerFromOpenAI(preset, undefined, new STMacroEvaluator());

        const env: MacroEnv = { user: "User", char: "Assistant" };
        const messages = manager.buildMessages(env, {});

        // 应该有一条消息
        expect(messages.length).toBe(1);
        // 消息应该包含 identifier 元数据
        const msgWithMeta = messages[0] as { identifier?: string; role: string; content: string };
        expect(msgWithMeta.identifier).toBe(identifier);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: st-prompt-compatibility, Property 7: Identifier 附加**
   * **Validates: Requirements 6.1**
   *
   * 多个 prompt 的 identifier 都应该被正确附加
   */
  it("多个 prompt 的 identifier 都被正确附加", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(validIdentifierArb, nonEmptyContentArb),
          { minLength: 2, maxLength: 5 },
        ),
        (promptConfigs) => {
          // 确保所有 identifier 唯一
          const identifiers = promptConfigs.map(([id]) => id);
          const uniqueIds = new Set(identifiers);
          if (uniqueIds.size !== identifiers.length) return; // 跳过重复 id

          const prompts: STPrompt[] = promptConfigs.map(([identifier, content]) => ({
            identifier,
            name: `Prompt: ${identifier}`,
            system_prompt: true,
            role: "system" as const,
            content,
          }));

          const preset: STOpenAIPreset = {
            prompts,
            prompt_order: [{
              character_id: 100001,
              order: prompts.map(p => ({ identifier: p.identifier, enabled: true })),
            }],
            temperature: 1,
          };

          const manager = createPromptManagerFromOpenAI(preset, undefined, new STMacroEvaluator());

          const env: MacroEnv = { user: "User", char: "Assistant" };
          const messages = manager.buildMessages(env, {});

          // 应该有正确数量的消息
          expect(messages.length).toBe(promptConfigs.length);

          // 每条消息都应该有正确的 identifier
          for (let i = 0; i < promptConfigs.length; i++) {
            const [expectedId, expectedContent] = promptConfigs[i];
            const msgWithMeta = messages[i] as { identifier?: string; content: string };
            expect(msgWithMeta.identifier).toBe(expectedId);
            expect(msgWithMeta.content).toBe(expectedContent);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: st-prompt-compatibility, Property 7: Identifier 附加**
   * **Validates: Requirements 6.1**
   *
   * marker prompt 的 identifier 也应该被附加
   */
  it("marker prompt 的 identifier 被附加", () => {
    fc.assert(
      fc.property(markerContentArb, (wiContent) => {
        const preset: STOpenAIPreset = {
          prompts: [{
            identifier: "worldInfoBefore",
            name: "World Info Before",
            system_prompt: true,
            role: "system",
            marker: true,
          }],
          prompt_order: [{
            character_id: 100001,
            order: [{ identifier: "worldInfoBefore", enabled: true }],
          }],
          temperature: 1,
        };

        const manager = createPromptManagerFromOpenAI(preset, undefined, new STMacroEvaluator());

        const env: MacroEnv = {
          user: "User",
          char: "Assistant",
          wiBefore: wiContent,
        };

        const messages = manager.buildMessages(env, {});

        // 应该有一条消息
        expect(messages.length).toBe(1);
        // marker prompt 的 identifier 应该被附加
        const msgWithMeta = messages[0] as { identifier?: string };
        expect(msgWithMeta.identifier).toBe("worldInfoBefore");
      }),
      { numRuns: 100 },
    );
  });
});
