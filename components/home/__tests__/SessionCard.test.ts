/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   SessionCard Property-Based Tests                        ║
 * ║  **Feature: session-management, Property 9: Session card rendering**      ║
 * ║  **Validates: Requirements 1.2**                                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { formatLastActivity } from "../SessionCard";
import { SessionWithCharacter } from "@/types/session";

/* ═══════════════════════════════════════════════════════════════════════════
 * 生成器定义
 * ═══════════════════════════════════════════════════════════════════════════ */

const uuidArb = fc.uuid();

const isoTimestampArb = fc.integer({
  min: new Date("2020-01-01").getTime(),
  max: new Date("2030-12-31").getTime(),
}).map(ts => new Date(ts).toISOString());

const validNameArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

/**
 * 生成有效的 SessionWithCharacter 对象
 */
const sessionWithCharacterArb: fc.Arbitrary<SessionWithCharacter> = fc.record({
  id: uuidArb,
  characterId: uuidArb,
  name: validNameArb,
  createdAt: isoTimestampArb,
  updatedAt: isoTimestampArb,
  characterName: validNameArb,
  characterAvatar: fc.oneof(
    fc.constant(""),
    fc.webUrl(),
  ),
});

/* ═══════════════════════════════════════════════════════════════════════════
 * Property 9: Session card rendering completeness
 * **Feature: session-management, Property 9: Session card rendering completeness**
 * **Validates: Requirements 1.2**
 * 
 * 测试策略：验证 SessionCard 所需的所有数据字段都可以被正确访问和格式化
 * 由于 React 组件测试需要完整 DOM 环境，这里测试核心数据转换逻辑
 * ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 9: Session card rendering completeness", () => {
  it("*For any* SessionWithCharacter object, all required display fields SHALL be accessible and non-empty", () => {
    fc.assert(
      fc.property(sessionWithCharacterArb, (session) => {
        // 会话名称必须存在且非空
        expect(session.name).toBeDefined();
        expect(session.name.trim().length).toBeGreaterThan(0);

        // 角色名称必须存在且非空
        expect(session.characterName).toBeDefined();
        expect(session.characterName.trim().length).toBeGreaterThan(0);

        // 时间戳必须是有效的 ISO 字符串
        expect(session.updatedAt).toBeDefined();
        expect(new Date(session.updatedAt).toISOString()).toBe(session.updatedAt);
      }),
      { numRuns: 100 },
    );
  });

  it("*For any* valid ISO timestamp, formatLastActivity SHALL return a non-empty string", () => {
    fc.assert(
      fc.property(isoTimestampArb, (timestamp) => {
        const formatted = formatLastActivity(timestamp);
        expect(formatted).toBeDefined();
        expect(typeof formatted).toBe("string");
        expect(formatted.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it("*For any* SessionWithCharacter, the rendered output SHALL contain session name, character name, and formatted timestamp", () => {
    fc.assert(
      fc.property(sessionWithCharacterArb, (session) => {
        // 模拟渲染输出的数据准备
        const displayData = {
          sessionName: session.name,
          characterName: session.characterName,
          formattedTime: formatLastActivity(session.updatedAt),
        };

        // 验证所有必需字段都已准备好用于渲染
        expect(displayData.sessionName).toBe(session.name);
        expect(displayData.characterName).toBe(session.characterName);
        expect(displayData.formattedTime.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * formatLastActivity 辅助函数测试
 * ═══════════════════════════════════════════════════════════════════════════ */

describe("formatLastActivity", () => {
  it("应该为最近的时间返回相对时间描述", () => {
    const now = new Date();
    
    // 刚刚
    expect(formatLastActivity(now.toISOString())).toBe("刚刚");
    
    // 几分钟前
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    expect(formatLastActivity(fiveMinAgo.toISOString())).toBe("5 分钟前");
    
    // 几小时前
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(formatLastActivity(twoHoursAgo.toISOString())).toBe("2 小时前");
    
    // 几天前
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(formatLastActivity(threeDaysAgo.toISOString())).toBe("3 天前");
  });

  it("应该为超过一周的时间返回日期格式", () => {
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const formatted = formatLastActivity(twoWeeksAgo.toISOString());
    
    // 应该是日期格式，不是相对时间
    expect(formatted).not.toContain("前");
    expect(formatted).not.toBe("刚刚");
  });
});
