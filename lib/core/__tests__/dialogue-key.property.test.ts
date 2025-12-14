/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              DialogueKey Property Tests                                   ║
 * ║                                                                           ║
 * ║  **Feature: compatibility-debt-remediation, Property 4: Session           ║
 * ║  DialogueKey 稳定性**                                                      ║
 * ║  **Validates: Requirements 5.4**                                          ║
 * ║                                                                           ║
 * ║  验证 DialogueKey 解析器的核心不变量：                                       ║
 * ║  *For any* session, once created, the `dialogueKey` SHALL remain          ║
 * ║  stable across all operations within that session's lifetime.             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  resolveDialogueKey,
  resolveDialogueKeyOrThrow,
  DialogueKeySource,
} from "../dialogue-key";

/* ═══════════════════════════════════════════════════════════════════════════
   生成器定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成有效的 ID 字符串（非空）
 */
const validIdArb = fc.string({ minLength: 1, maxLength: 50 }).filter(
  (s) => s.trim().length > 0,
);

/**
 * 生成可选的 ID 字符串（可能为 null/undefined）
 */
const optionalIdArb = fc.oneof(
  validIdArb,
  fc.constant(null),
  fc.constant(undefined),
);

/**
 * 生成 DialogueKeySource 对象
 */
const dialogueKeySourceArb = fc.record({
  dialogueKey: optionalIdArb,
  sessionId: optionalIdArb,
  characterId: optionalIdArb,
});

/**
 * 生成至少有一个有效 ID 的 DialogueKeySource
 */
const validDialogueKeySourceArb = fc.record({
  dialogueKey: optionalIdArb,
  sessionId: optionalIdArb,
  characterId: optionalIdArb,
}).filter((source) => {
  return !!(source.dialogueKey || source.sessionId || source.characterId);
});

/**
 * 生成所有字段都为空的 DialogueKeySource
 */
const emptyDialogueKeySourceArb = fc.record({
  dialogueKey: fc.constant(null as string | null | undefined),
  sessionId: fc.constant(null as string | null | undefined),
  characterId: fc.constant(null as string | null | undefined),
});

/* ═══════════════════════════════════════════════════════════════════════════
   属性测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 4: Session DialogueKey 稳定性", () => {
  /**
   * **Feature: compatibility-debt-remediation, Property 4: Session DialogueKey 稳定性**
   * **Validates: Requirements 5.4**
   *
   * 对于相同的输入源，resolveDialogueKey 应该始终返回相同的结果
   */
  it("*For any* DialogueKeySource, resolveDialogueKey SHALL return the same result for identical inputs", () => {
    fc.assert(
      fc.property(dialogueKeySourceArb, (source) => {
        const result1 = resolveDialogueKey(source);
        const result2 = resolveDialogueKey(source);
        const result3 = resolveDialogueKey({ ...source });

        // 幂等性：多次调用应该返回相同结果
        expect(result1).toBe(result2);
        expect(result1).toBe(result3);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 4: Session DialogueKey 稳定性**
   * **Validates: Requirements 5.1**
   *
   * dialogueKey 优先级最高
   */
  it("*For any* source with dialogueKey, the result SHALL be dialogueKey regardless of other fields", () => {
    fc.assert(
      fc.property(validIdArb, optionalIdArb, optionalIdArb, (dialogueKey, sessionId, characterId) => {
        const source: DialogueKeySource = { dialogueKey, sessionId, characterId };
        const result = resolveDialogueKey(source);

        expect(result).toBe(dialogueKey);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 4: Session DialogueKey 稳定性**
   * **Validates: Requirements 5.1**
   *
   * 当 dialogueKey 为空时，sessionId 优先级次之
   */
  it("*For any* source without dialogueKey but with sessionId, the result SHALL be sessionId", () => {
    fc.assert(
      fc.property(validIdArb, optionalIdArb, (sessionId, characterId) => {
        const source: DialogueKeySource = {
          dialogueKey: null,
          sessionId,
          characterId,
        };
        const result = resolveDialogueKey(source);

        expect(result).toBe(sessionId);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 4: Session DialogueKey 稳定性**
   * **Validates: Requirements 5.1**
   *
   * 当 dialogueKey 和 sessionId 都为空时，使用 characterId
   */
  it("*For any* source with only characterId, the result SHALL be characterId", () => {
    fc.assert(
      fc.property(validIdArb, (characterId) => {
        const source: DialogueKeySource = {
          dialogueKey: null,
          sessionId: null,
          characterId,
        };
        const result = resolveDialogueKey(source);

        expect(result).toBe(characterId);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 4: Session DialogueKey 稳定性**
   * **Validates: Requirements 5.4**
   *
   * 当所有字段都为空时，返回 null
   */
  it("*For any* source with all empty fields, resolveDialogueKey SHALL return null", () => {
    fc.assert(
      fc.property(emptyDialogueKeySourceArb, (source) => {
        const result = resolveDialogueKey(source);
        expect(result).toBeNull();
      }),
      { numRuns: 50 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 4: Session DialogueKey 稳定性**
   * **Validates: Requirements 5.4**
   *
   * resolveDialogueKeyOrThrow 在有有效输入时应该返回非空字符串
   */
  it("*For any* valid source, resolveDialogueKeyOrThrow SHALL return a non-empty string", () => {
    fc.assert(
      fc.property(validDialogueKeySourceArb, (source) => {
        const result = resolveDialogueKeyOrThrow(source);

        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 4: Session DialogueKey 稳定性**
   * **Validates: Requirements 5.4**
   *
   * resolveDialogueKeyOrThrow 在所有字段为空时应该抛出错误
   */
  it("*For any* empty source, resolveDialogueKeyOrThrow SHALL throw an error", () => {
    fc.assert(
      fc.property(emptyDialogueKeySourceArb, (source) => {
        expect(() => resolveDialogueKeyOrThrow(source)).toThrow();
      }),
      { numRuns: 50 },
    );
  });

  /**
   * **Feature: compatibility-debt-remediation, Property 4: Session DialogueKey 稳定性**
   * **Validates: Requirements 5.4**
   *
   * 优先级链的传递性：如果 A > B > C，则结果遵循优先级
   */
  it("*For any* source, the priority chain SHALL be: dialogueKey > sessionId > characterId", () => {
    fc.assert(
      fc.property(validIdArb, validIdArb, validIdArb, (dk, sid, cid) => {
        // 全部有值时，使用 dialogueKey
        expect(resolveDialogueKey({ dialogueKey: dk, sessionId: sid, characterId: cid })).toBe(dk);

        // 没有 dialogueKey 时，使用 sessionId
        expect(resolveDialogueKey({ dialogueKey: null, sessionId: sid, characterId: cid })).toBe(sid);

        // 只有 characterId 时，使用 characterId
        expect(resolveDialogueKey({ dialogueKey: null, sessionId: null, characterId: cid })).toBe(cid);
      }),
      { numRuns: 100 },
    );
  });
});

describe("Property: DialogueKey 解析器边界情况", () => {
  /**
   * 空字符串应该被视为无效值（falsy）
   */
  it("*For any* source with empty string fields, they SHALL be treated as falsy", () => {
    fc.assert(
      fc.property(validIdArb, (validId) => {
        // 空字符串 dialogueKey 应该回退到 sessionId
        const result1 = resolveDialogueKey({
          dialogueKey: "",
          sessionId: validId,
          characterId: null,
        });
        expect(result1).toBe(validId);

        // 空字符串 sessionId 应该回退到 characterId
        const result2 = resolveDialogueKey({
          dialogueKey: null,
          sessionId: "",
          characterId: validId,
        });
        expect(result2).toBe(validId);
      }),
      { numRuns: 50 },
    );
  });

  /**
   * undefined 和 null 应该被同等对待
   */
  it("*For any* source, null and undefined SHALL be treated equivalently", () => {
    fc.assert(
      fc.property(validIdArb, (validId) => {
        const resultWithNull = resolveDialogueKey({
          dialogueKey: null,
          sessionId: null,
          characterId: validId,
        });

        const resultWithUndefined = resolveDialogueKey({
          dialogueKey: undefined,
          sessionId: undefined,
          characterId: validId,
        });

        expect(resultWithNull).toBe(resultWithUndefined);
        expect(resultWithNull).toBe(validId);
      }),
      { numRuns: 50 },
    );
  });
});
