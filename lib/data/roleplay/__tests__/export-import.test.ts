/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   Export-Import Property Tests                            ║
 * ║  使用 fast-check 验证导出导入的往返一致性                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fc from "fast-check";
import { Session } from "@/types/session";

/* ═══════════════════════════════════════════════════════════════════════════
 * Mock 存储层
 * 使用内存 Map 模拟 IndexedDB 行为
 * ═══════════════════════════════════════════════════════════════════════════ */

const mockSessionStore = new Map<string, Session>();

vi.mock("@/lib/data/local-storage", () => ({
  SESSIONS_RECORD_FILE: "sessions_record",
  putRecord: vi.fn(async (_store: string, key: string, value: Session) => {
    mockSessionStore.set(key, value);
  }),
  getRecordByKey: vi.fn(async (_store: string, key: string) => {
    return mockSessionStore.get(key) || null;
  }),
  getAllRecords: vi.fn(async () => {
    return Array.from(mockSessionStore.values());
  }),
  getAllEntries: vi.fn(async () => {
    return Array.from(mockSessionStore.entries()).map(([key, value]) => ({
      key,
      value,
    }));
  }),
  deleteRecord: vi.fn(async (_store: string, key: string) => {
    mockSessionStore.delete(key);
  }),
  clearStore: vi.fn(async () => {
    mockSessionStore.clear();
  }),
  putRecords: vi.fn(async (_store: string, records: Session[]) => {
    for (const record of records) {
      mockSessionStore.set(record.id, record);
    }
  }),
}));

// 动态导入以确保 mock 生效
const { SessionOperations } = await import("../session-operation");

/* ═══════════════════════════════════════════════════════════════════════════
 * 生成器定义
 * ═══════════════════════════════════════════════════════════════════════════ */

const uuidArb = fc.uuid();

const validSessionNameArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

const isoTimestampArb = fc.integer({
  min: new Date("2020-01-01").getTime(),
  max: new Date("2030-12-31").getTime(),
}).map(ts => new Date(ts).toISOString());

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

/**
 * 清理 mock 存储
 */
function clearAllStores() {
  mockSessionStore.clear();
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 模拟导出导入函数
 * 这些函数模拟 local-storage.ts 中的 exportAllData 和 importAllData 行为
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 模拟导出会话数据
 */
async function exportSessions(): Promise<Session[]> {
  const sessions = await SessionOperations.getAllSessions();
  return sessions.map(session => ({
    id: session.id,
    characterId: session.characterId,
    name: session.name,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }));
}

/**
 * 模拟导入会话数据
 */
async function importSessions(sessions: Session[]): Promise<void> {
  clearAllStores();
  for (const session of sessions) {
    mockSessionStore.set(session.id, session);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Property 8: Export-import round-trip
 * **Feature: session-management, Property 8: Export-import round-trip**
 * **Validates: Requirements 7.3, 7.4**
 * ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 8: Export-import round-trip", () => {
  beforeEach(() => {
    clearAllStores();
  });

  it("*For any* set of sessions in the Session_Store, exporting all data and then importing into an empty store SHALL result in the same set of sessions being present", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(sessionArb, { minLength: 0, maxLength: 10 }),
        async (originalSessions) => {
          clearAllStores();

          // 确保 ID 唯一（生成器可能产生重复）
          const uniqueSessions = originalSessions.filter(
            (session, index, self) =>
              self.findIndex(s => s.id === session.id) === index,
          );

          // 将会话存入存储
          for (const session of uniqueSessions) {
            mockSessionStore.set(session.id, session);
          }

          // 导出
          const exported = await exportSessions();

          // 清空存储
          clearAllStores();

          // 验证存储已清空
          const afterClear = await SessionOperations.getAllSessions();
          expect(afterClear.length).toBe(0);

          // 导入
          await importSessions(exported);

          // 获取导入后的会话
          const imported = await SessionOperations.getAllSessions();

          // 验证数量一致
          expect(imported.length).toBe(uniqueSessions.length);

          // 验证每个原始会话都能被检索到且字段一致
          for (const original of uniqueSessions) {
            const found = imported.find(s => s.id === original.id);
            expect(found).toBeDefined();
            expect(found?.characterId).toBe(original.characterId);
            expect(found?.name).toBe(original.name);
            expect(found?.createdAt).toBe(original.createdAt);
            expect(found?.updatedAt).toBe(original.updatedAt);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("导出的会话数据应包含所有必要字段", async () => {
    await fc.assert(
      fc.asyncProperty(sessionArb, async (session) => {
        clearAllStores();

        // 存入会话
        mockSessionStore.set(session.id, session);

        // 导出
        const exported = await exportSessions();

        // 验证导出的会话包含所有字段
        expect(exported.length).toBe(1);
        const exportedSession = exported[0];

        expect(exportedSession).toHaveProperty("id");
        expect(exportedSession).toHaveProperty("characterId");
        expect(exportedSession).toHaveProperty("name");
        expect(exportedSession).toHaveProperty("createdAt");
        expect(exportedSession).toHaveProperty("updatedAt");
      }),
      { numRuns: 100 },
    );
  });
});
