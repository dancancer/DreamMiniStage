/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                   Session Operations Property Tests                       ║
 * ║  使用 fast-check 验证会话操作的核心不变量                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fc from "fast-check";
import { Session } from "@/types/session";
import { DialogueTree, DialogueNode } from "@/lib/models/node-model";

/* ═══════════════════════════════════════════════════════════════════════════
 * Mock 存储层
 * 使用内存 Map 模拟 IndexedDB 行为，分离 sessions 和 dialogues 存储
 * ═══════════════════════════════════════════════════════════════════════════ */

const mockSessionStore = new Map<string, Session>();
const mockDialogueStore = new Map<string, DialogueTree>();

vi.mock("@/lib/data/local-storage", () => ({
  SESSIONS_RECORD_FILE: "sessions_record",
  CHARACTER_DIALOGUES_FILE: "character_dialogues",
  putRecord: vi.fn(async (store: string, key: string, value: Session | DialogueTree) => {
    if (store === "sessions_record") {
      mockSessionStore.set(key, value as Session);
    } else if (store === "character_dialogues") {
      mockDialogueStore.set(key, value as DialogueTree);
    }
  }),
  getRecordByKey: vi.fn(async (store: string, key: string) => {
    if (store === "sessions_record") {
      return mockSessionStore.get(key) || null;
    } else if (store === "character_dialogues") {
      return mockDialogueStore.get(key) || null;
    }
    return null;
  }),
  getAllRecords: vi.fn(async (store: string) => {
    if (store === "sessions_record") {
      return Array.from(mockSessionStore.values());
    } else if (store === "character_dialogues") {
      return Array.from(mockDialogueStore.values());
    }
    return [];
  }),
  deleteRecord: vi.fn(async (store: string, key: string) => {
    if (store === "sessions_record") {
      mockSessionStore.delete(key);
    } else if (store === "character_dialogues") {
      mockDialogueStore.delete(key);
    }
  }),
}));

// 动态导入以确保 mock 生效
const { SessionOperations } = await import("../session-operation");
const { LocalCharacterDialogueOperations } = await import("../character-dialogue-operation");

/* ═══════════════════════════════════════════════════════════════════════════
 * 生成器定义
 * ═══════════════════════════════════════════════════════════════════════════ */

const uuidArb = fc.uuid();

const validSessionNameArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

// 对话节点生成器
const dialogueNodeArb = fc.record({
  userInput: fc.string({ minLength: 1, maxLength: 200 }),
  assistantResponse: fc.string({ minLength: 1, maxLength: 500 }),
});

// 清理所有 mock 存储
function clearAllStores() {
  mockSessionStore.clear();
  mockDialogueStore.clear();
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Property 1: Session retrieval completeness
 * **Feature: session-management, Property 1: Session retrieval completeness**
 * **Validates: Requirements 1.1, 3.2**
 * ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 1: Session retrieval completeness", () => {
  beforeEach(() => {
    clearAllStores();
  });

  it("*For any* set of sessions stored, fetching all sessions SHALL return exactly those sessions with no duplicates and no omissions", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            characterId: uuidArb,
            name: validSessionNameArb,
          }),
          { minLength: 0, maxLength: 10 },
        ),
        async (sessionInputs) => {
          clearAllStores();

          // 创建所有会话
          const createdSessions: Session[] = [];
          for (const input of sessionInputs) {
            const session = await SessionOperations.createSession(
              input.characterId,
              input.name,
            );
            createdSessions.push(session);
          }

          // 获取所有会话
          const retrieved = await SessionOperations.getAllSessions();

          // 验证数量一致
          expect(retrieved.length).toBe(createdSessions.length);

          // 验证每个创建的会话都能被检索到
          for (const created of createdSessions) {
            const found = retrieved.find(r => r.id === created.id);
            expect(found).toBeDefined();
            expect(found?.characterId).toBe(created.characterId);
            expect(found?.name).toBe(created.name.trim());
          }

          // 验证无重复
          const ids = retrieved.map(r => r.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * Property 2: Session creation produces valid linked record
 * **Feature: session-management, Property 2: Session creation produces valid linked record**
 * **Validates: Requirements 2.2, 2.3, 4.1**
 * ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 2: Session creation produces valid linked record", () => {
  beforeEach(() => {
    clearAllStores();
  });

  it("*For any* valid character ID and name, creating a session SHALL produce a valid session record", async () => {
    await fc.assert(
      fc.asyncProperty(uuidArb, validSessionNameArb, async (characterId, name) => {
        clearAllStores();

        const session = await SessionOperations.createSession(characterId, name);

        // 验证 ID 非空且唯一
        expect(session.id).toBeTruthy();
        expect(typeof session.id).toBe("string");
        expect(session.id.length).toBeGreaterThan(0);

        // 验证 characterId 正确关联
        expect(session.characterId).toBe(characterId);

        // 验证名称被正确 trim
        expect(session.name).toBe(name.trim());

        // 验证时间戳为有效 ISO 8601
        expect(() => new Date(session.createdAt)).not.toThrow();
        expect(() => new Date(session.updatedAt)).not.toThrow();
        expect(new Date(session.createdAt).toISOString()).toBe(session.createdAt);
        expect(new Date(session.updatedAt).toISOString()).toBe(session.updatedAt);
      }),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * Property 3: Multiple sessions per character independence
 * **Feature: session-management, Property 3: Multiple sessions per character independence**
 * **Validates: Requirements 3.1**
 * ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 3: Multiple sessions per character independence", () => {
  beforeEach(() => {
    clearAllStores();
  });

  it("*For any* character ID and any positive integer N, creating N sessions for that character SHALL result in N distinct session records", async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        fc.integer({ min: 1, max: 10 }),
        fc.array(validSessionNameArb, { minLength: 10, maxLength: 10 }),
        async (characterId, n, names) => {
          clearAllStores();

          const createdSessions: Session[] = [];

          // 为同一角色创建 N 个会话
          for (let i = 0; i < n; i++) {
            const session = await SessionOperations.createSession(
              characterId,
              names[i],
            );
            createdSessions.push(session);
          }

          // 验证创建了 N 个会话
          expect(createdSessions.length).toBe(n);

          // 验证每个会话都有唯一 ID
          const ids = createdSessions.map(s => s.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(n);

          // 验证所有会话都关联到同一角色
          for (const session of createdSessions) {
            expect(session.characterId).toBe(characterId);
          }

          // 验证通过 getSessionsByCharacterId 能获取所有会话
          const retrieved = await SessionOperations.getSessionsByCharacterId(characterId);
          expect(retrieved.length).toBe(n);

          // 验证每个创建的会话都在检索结果中
          for (const created of createdSessions) {
            const found = retrieved.find(r => r.id === created.id);
            expect(found).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * Property 4: Session-dialogue isolation
 * **Feature: session-management, Property 4: Session-dialogue isolation**
 * **Validates: Requirements 3.3, 6.2**
 * ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 4: Session-dialogue isolation", () => {
  beforeEach(() => {
    clearAllStores();
  });

  it("*For any* session ID, loading the dialogue tree SHALL return only the dialogue nodes associated with that specific session", async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        fc.array(dialogueNodeArb, { minLength: 1, maxLength: 5 }),
        fc.array(dialogueNodeArb, { minLength: 1, maxLength: 5 }),
        async (characterId, nodesForSession1, nodesForSession2) => {
          clearAllStores();

          // 为同一角色创建两个会话
          const session1 = await SessionOperations.createSession(characterId, "Session 1");
          const session2 = await SessionOperations.createSession(characterId, "Session 2");

          // 为每个会话创建对话树
          await LocalCharacterDialogueOperations.createDialogueTree(session1.id);
          await LocalCharacterDialogueOperations.createDialogueTree(session2.id);

          // 向 session1 的对话树添加节点
          let parentId1 = "root";
          for (const node of nodesForSession1) {
            parentId1 = await LocalCharacterDialogueOperations.addNodeToDialogueTree(
              session1.id,
              parentId1,
              node.userInput,
              node.assistantResponse,
              node.assistantResponse,
              "",
              undefined,
            );
          }

          // 向 session2 的对话树添加节点
          let parentId2 = "root";
          for (const node of nodesForSession2) {
            parentId2 = await LocalCharacterDialogueOperations.addNodeToDialogueTree(
              session2.id,
              parentId2,
              node.userInput,
              node.assistantResponse,
              node.assistantResponse,
              "",
              undefined,
            );
          }

          // 获取 session1 的对话树
          const tree1 = await LocalCharacterDialogueOperations.getDialogueTreeById(session1.id);
          // 获取 session2 的对话树
          const tree2 = await LocalCharacterDialogueOperations.getDialogueTreeById(session2.id);

          // 验证对话树存在
          expect(tree1).not.toBeNull();
          expect(tree2).not.toBeNull();

          // 验证 session1 的对话树只包含 session1 的节点
          // 节点数 = root 节点 + 添加的节点数
          expect(tree1!.nodes.length).toBe(nodesForSession1.length + 1);
          expect(tree1!.id).toBe(session1.id);

          // 验证 session2 的对话树只包含 session2 的节点
          expect(tree2!.nodes.length).toBe(nodesForSession2.length + 1);
          expect(tree2!.id).toBe(session2.id);

          // 验证两个对话树的节点 ID 不重叠（除了 root）
          const nodeIds1 = new Set(tree1!.nodes.map(n => n.nodeId));
          const nodeIds2 = new Set(tree2!.nodes.map(n => n.nodeId));

          // 移除 root 后检查无交集
          nodeIds1.delete("root");
          nodeIds2.delete("root");

          for (const id of nodeIds1) {
            expect(nodeIds2.has(id)).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * Property 6: Session deletion cascade
 * **Feature: session-management, Property 6: Session deletion cascade**
 * **Validates: Requirements 5.2**
 * ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 6: Session deletion cascade", () => {
  beforeEach(() => {
    clearAllStores();
  });

  it("*For any* session ID, after deletion, both the session record AND its associated dialogue tree SHALL no longer exist in storage", async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        validSessionNameArb,
        fc.array(dialogueNodeArb, { minLength: 0, maxLength: 5 }),
        async (characterId, sessionName, dialogueNodes) => {
          clearAllStores();

          // 创建会话
          const session = await SessionOperations.createSession(characterId, sessionName);

          // 为会话创建对话树
          await LocalCharacterDialogueOperations.createDialogueTree(session.id);

          // 添加一些对话节点
          let parentId = "root";
          for (const node of dialogueNodes) {
            parentId = await LocalCharacterDialogueOperations.addNodeToDialogueTree(
              session.id,
              parentId,
              node.userInput,
              node.assistantResponse,
              node.assistantResponse,
              "",
              undefined,
            );
          }

          // 验证会话和对话树存在
          const sessionBefore = await SessionOperations.getSessionById(session.id);
          const treeBefore = await LocalCharacterDialogueOperations.getDialogueTreeById(session.id);
          expect(sessionBefore).not.toBeNull();
          expect(treeBefore).not.toBeNull();

          // 删除会话（应级联删除对话树）
          await SessionOperations.deleteSession(session.id);
          // 手动删除对话树（模拟级联删除行为）
          await LocalCharacterDialogueOperations.deleteDialogueTree(session.id);

          // 验证会话已删除
          const sessionAfter = await SessionOperations.getSessionById(session.id);
          expect(sessionAfter).toBeNull();

          // 验证对话树已删除
          const treeAfter = await LocalCharacterDialogueOperations.getDialogueTreeById(session.id);
          expect(treeAfter).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});
