/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     Session Property-Based Tests                          ║
 * ║  使用 fast-check 验证会话相关的核心不变量                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  Session,
  serializeSession,
  deserializeSession,
  isValidSessionName,
  generateDefaultSessionName,
} from "../session";

/* ═══════════════════════════════════════════════════════════════════════════
 * 生成器定义
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成有效的 ISO 8601 时间戳
 * 使用整数时间戳避免无效日期问题
 */
const isoTimestampArb = fc.integer({
  min: new Date("2020-01-01").getTime(),
  max: new Date("2030-12-31").getTime(),
}).map(ts => new Date(ts).toISOString());

/**
 * 生成有效的 UUID v4
 */
const uuidArb = fc.uuid();

/**
 * 生成非空会话名称（至少包含一个非空白字符）
 */
const validSessionNameArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

/**
 * 生成有效的 Session 对象
 */
const sessionArb: fc.Arbitrary<Session> = fc.record({
  id: uuidArb,
  characterId: uuidArb,
  name: validSessionNameArb,
  createdAt: isoTimestampArb,
  updatedAt: isoTimestampArb,
});

/* ═══════════════════════════════════════════════════════════════════════════
 * Property 7: Session serialization round-trip
 * **Feature: session-management, Property 7: Session serialization round-trip**
 * **Validates: Requirements 7.5**
 * ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 7: Session serialization round-trip", () => {
  it("*For any* valid Session object, serializing to JSON and then deserializing SHALL produce an object equivalent to the original", () => {
    fc.assert(
      fc.property(sessionArb, (session) => {
        const serialized = serializeSession(session);
        const deserialized = deserializeSession(serialized);

        expect(deserialized.id).toBe(session.id);
        expect(deserialized.characterId).toBe(session.characterId);
        expect(deserialized.name).toBe(session.name);
        expect(deserialized.createdAt).toBe(session.createdAt);
        expect(deserialized.updatedAt).toBe(session.updatedAt);
      }),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * Property 5: Session name validation
 * **Feature: session-management, Property 5: Session name validation**
 * **Validates: Requirements 4.2, 4.3**
 * ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 5: Session name validation", () => {
  it("*For any* string composed entirely of whitespace characters, validation SHALL reject it", () => {
    const whitespaceOnlyArb = fc.array(
      fc.constantFrom(" ", "\t", "\n", "\r"),
      { minLength: 0, maxLength: 50 },
    ).map(arr => arr.join(""));

    fc.assert(
      fc.property(whitespaceOnlyArb, (whitespaceStr: string) => {
        expect(isValidSessionName(whitespaceStr)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("*For any* string containing at least one non-whitespace character, validation SHALL accept it", () => {
    fc.assert(
      fc.property(validSessionNameArb, (validName) => {
        expect(isValidSessionName(validName)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 辅助函数测试
 * ═══════════════════════════════════════════════════════════════════════════ */

describe("generateDefaultSessionName", () => {
  it("生成的名称应包含角色名", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (characterName) => {
          const name = generateDefaultSessionName(characterName);
          expect(name).toContain(characterName);
        },
      ),
      { numRuns: 100 },
    );
  });
});
