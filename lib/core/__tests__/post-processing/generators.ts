/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              消息后处理管线 - 测试生成器                                     ║
 * ║                                                                            ║
 * ║  共享的 fast-check 生成器，供所有属性测试使用                                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import * as fc from "fast-check";
import type {
  ExtendedChatMessage,
  PromptNames,
  ContentPart,
} from "../../st-preset-types";

/* ═══════════════════════════════════════════════════════════════════════════
   基础生成器
   ═══════════════════════════════════════════════════════════════════════════ */

/** 非空名称字符串 */
export const nonEmptyNameArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.trim().length > 0 && !s.includes(":"));

/** 消息角色（不含 tool） */
export const roleArb = fc.constantFrom(
  "system" as const,
  "user" as const,
  "assistant" as const,
);

/** 完整角色（含 tool） */
export const fullRoleArb = fc.constantFrom(
  "system" as const,
  "user" as const,
  "assistant" as const,
  "tool" as const,
);

/** 非空消息内容 */
export const contentArb = fc.string({ minLength: 1, maxLength: 100 });

/* ═══════════════════════════════════════════════════════════════════════════
   多模态内容生成器
   ═══════════════════════════════════════════════════════════════════════════ */

/** 文本内容片段 */
export const textPartArb = fc.record({
  type: fc.constant<"text">("text"),
  text: fc.string({ minLength: 1, maxLength: 100 }),
});

/** 非文本内容片段 */
export const nonTextPartArb = fc.oneof(
  fc.record({
    type: fc.constant<"image_url">("image_url"),
    image_url: fc.record({ url: fc.string({ minLength: 1, maxLength: 100 }) }),
  }),
  fc.record({
    type: fc.constant<"video_url">("video_url"),
    video_url: fc.record({ url: fc.string({ minLength: 1, maxLength: 100 }) }),
  }),
  fc.record({
    type: fc.constant<"audio_url">("audio_url"),
    audio_url: fc.record({ url: fc.string({ minLength: 1, maxLength: 100 }) }),
  }),
);

/** 包含文本的多模态内容数组 */
export const contentArrayWithTextArb = fc
  .array(fc.oneof(textPartArb, nonTextPartArb), { minLength: 1, maxLength: 5 })
  .filter((parts) => parts.some((part) => part.type === "text"));

/** 无文本的多模态内容数组 */
export const contentArrayWithoutTextArb = fc.array(nonTextPartArb, {
  minLength: 1,
  maxLength: 5,
});

/** 多模态消息内容（字符串或 ContentPart[]） */
export const richContentArb = fc.oneof(
  contentArb,
  contentArrayWithTextArb,
  contentArrayWithoutTextArb,
) as fc.Arbitrary<string | ContentPart[]>;

/* ═══════════════════════════════════════════════════════════════════════════
   PromptNames 生成器
   ═══════════════════════════════════════════════════════════════════════════ */

/** PromptNames 对象 */
export const promptNamesArb: fc.Arbitrary<PromptNames> = fc
  .record({
    charName: nonEmptyNameArb,
    userName: nonEmptyNameArb,
    groupNames: fc.array(nonEmptyNameArb, { minLength: 0, maxLength: 5 }),
  })
  .map(({ charName, userName, groupNames }) => ({
    charName,
    userName,
    groupNames,
    startsWithGroupName: (msg: string) =>
      groupNames.some((name) => msg.startsWith(`${name}: `)),
  }));

/* ═══════════════════════════════════════════════════════════════════════════
   消息生成器
   ═══════════════════════════════════════════════════════════════════════════ */

/** 带 name 字段的消息 */
export const messageWithNameArb = fc.record({
  role: roleArb,
  content: richContentArb,
  name: fc.oneof(
    nonEmptyNameArb,
    fc.constant("example_assistant"),
    fc.constant("example_user"),
  ),
});

/** 不带 name 字段的消息 */
export const messageWithoutNameArb = fc.record({
  role: roleArb,
  content: richContentArb,
});

/** 混合消息数组 */
export const messagesArb = fc.array(
  fc.oneof(messageWithNameArb, messageWithoutNameArb),
  { minLength: 0, maxLength: 20 },
) as fc.Arbitrary<ExtendedChatMessage[]>;

/** 带完整角色的消息 */
export const messageWithFullRoleArb = fc.record({
  role: fullRoleArb,
  content: contentArb,
});

/** 消息数组（含 tool 角色） */
export const messagesWithToolArb = fc.array(messageWithFullRoleArb, {
  minLength: 0,
  maxLength: 30,
}) as fc.Arbitrary<ExtendedChatMessage[]>;

/* ═══════════════════════════════════════════════════════════════════════════
   工具相关生成器
   ═══════════════════════════════════════════════════════════════════════════ */

/** ToolCall 对象 */
export const toolCallArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  type: fc.constant("function" as const),
  function: fc.record({
    name: fc.string({ minLength: 1, maxLength: 20 }),
    arguments: fc.json(),
  }),
});

/** 带 tool_calls 的 assistant 消息 */
export const messageWithToolCallsArb = fc.record({
  role: fc.constant("assistant" as const),
  content: contentArb,
  tool_calls: fc.array(toolCallArb, { minLength: 1, maxLength: 3 }),
});

/** 带 tool_call_id 的 tool 消息 */
export const toolMessageArb = fc.record({
  role: fc.constant("tool" as const),
  content: contentArb,
  tool_call_id: fc.string({ minLength: 1, maxLength: 20 }),
});

/** 混合消息数组（含工具相关字段） */
export const messagesWithToolFieldsArb = fc.array(
  fc.oneof(messageWithToolCallsArb, toolMessageArb, messageWithoutNameArb),
  { minLength: 1, maxLength: 15 },
) as fc.Arbitrary<ExtendedChatMessage[]>;

/* ═══════════════════════════════════════════════════════════════════════════
   辅助函数
   ═══════════════════════════════════════════════════════════════════════════ */

/** 计算期望的前缀 */
export function getExpectedPrefix(name: string, names: PromptNames): string {
  if (name === "example_assistant") {
    return names.charName ? `${names.charName}: ` : "";
  }
  if (name === "example_user") {
    return names.userName ? `${names.userName}: ` : "";
  }
  return name ? `${name}: ` : "";
}
