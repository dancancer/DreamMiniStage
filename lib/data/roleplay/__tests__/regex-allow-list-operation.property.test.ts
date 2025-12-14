/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║           Regex Allow List Operations Property Tests                      ║
 * ║                                                                           ║
 * ║  **Feature: regex-sillytavern-compat, Property 3: 授权列表持久化往返**     ║
 * ║  **Validates: Requirements 2.3, 2.4**                                     ║
 * ║                                                                           ║
 * ║  验证授权列表操作的核心不变量：                                             ║
 * ║  *For any* character ID or preset name, adding it to the allow list       ║
 * ║  and then checking should return true, and removing it should return false║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fc from "fast-check";
import { RegexAllowList } from "@/lib/models/regex-script-model";

/* ═══════════════════════════════════════════════════════════════════════════
   Mock 存储层
   使用内存 Map 模拟 IndexedDB 行为
   
   设计理念：
   1. 容器模式 - 闭包捕获容器对象，而非 Map 本身
   2. 深拷贝隔离 - 每次读写都返回新对象
   3. 显式清理 - 重新创建 Map 实例确保完全清空
   
   关键：使用对象包装 Map，让闭包捕获对象引用而非 Map 引用
   ═══════════════════════════════════════════════════════════════════════════ */

// 容器对象 - 闭包捕获这个对象，而不是 Map 本身
const mockStoreContainer = {
  store: new Map<string, RegexAllowList>(),
};

// 辅助函数：深拷贝
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// 辅助函数：清空 store - 使用 clear() 方法而不是重新创建实例
function clearMockStore() {
  mockStoreContainer.store.clear();
}

vi.mock("@/lib/data/local-storage", () => ({
  REGEX_ALLOW_LIST_FILE: "regex_allow_list",
  getRecordByKey: async (store: string, key: string) => {
    if (store === "regex_allow_list") {
      const value = mockStoreContainer.store.get(key);
      return value ? deepClone(value) : null;
    }
    return null;
  },
  putRecord: async (store: string, key: string, value: RegexAllowList) => {
    if (store === "regex_allow_list") {
      mockStoreContainer.store.set(key, deepClone(value));
    }
  },
}));

// 动态导入以确保 mock 生效
const { AllowListOperations } = await import("../regex-allow-list-operation");

/* ═══════════════════════════════════════════════════════════════════════════
   测试环境设置
   ═══════════════════════════════════════════════════════════════════════════ */

beforeEach(() => {
  // 每个测试前清空授权列表，确保测试独立性
  clearMockStore();
});

/* ═══════════════════════════════════════════════════════════════════════════
   生成器定义
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成角色 ID
 * 格式：character_<uuid>
 */
const characterIdArb = fc.uuid().map(uuid => `character_${uuid}`);

/**
 * 生成 API 类型标识符
 */
const apiIdArb = fc.constantFrom(
  "openai",
  "gemini",
  "anthropic",
  "cohere",
  "local",
);

/**
 * 生成预设名称
 */
const presetNameArb = fc.stringMatching(/^[a-zA-Z0-9_-]+$/)
  .filter(s => s.length > 0 && s.length <= 30);

/* ═══════════════════════════════════════════════════════════════════════════
   属性测试 - Property 3: 授权列表持久化往返
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 3: 授权列表持久化往返", () => {
  /**
   * **Feature: regex-sillytavern-compat, Property 3: 授权列表持久化往返**
   * **Validates: Requirements 2.3**
   * 
   * 角色授权往返：添加后检查应该返回 true
   */
  it("*For any* character ID, adding it then checking SHALL return true", async () => {
    await fc.assert(
      fc.asyncProperty(
        characterIdArb,
        async (characterId) => {
          // 清空状态
          clearMockStore();
          
          // 添加到授权列表
          await AllowListOperations.allowCharacter(characterId);
          
          // 检查应该返回 true
          const isAllowed = await AllowListOperations.isCharacterAllowed(characterId);
          expect(isAllowed).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 3: 授权列表持久化往返**
   * **Validates: Requirements 2.4**
   * 
   * 角色授权往返：移除后检查应该返回 false
   */
  it("*For any* character ID, removing it then checking SHALL return false", async () => {
    await fc.assert(
      fc.asyncProperty(
        characterIdArb,
        async (characterId) => {
          // 清空状态
          clearMockStore();
          
          // 先添加
          await AllowListOperations.allowCharacter(characterId);
          
          // 再移除
          await AllowListOperations.disallowCharacter(characterId);
          
          // 检查应该返回 false
          const isAllowed = await AllowListOperations.isCharacterAllowed(characterId);
          expect(isAllowed).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 3: 授权列表持久化往返**
   * **Validates: Requirements 2.3**
   * 
   * 预设授权往返：添加后检查应该返回 true
   */
  it("*For any* API ID and preset name, adding it then checking SHALL return true", async () => {
    await fc.assert(
      fc.asyncProperty(
        apiIdArb,
        presetNameArb,
        async (apiId, presetName) => {
          // 清空状态
          clearMockStore();
          
          // 添加到授权列表
          await AllowListOperations.allowPreset(apiId, presetName);
          
          // 检查应该返回 true
          const isAllowed = await AllowListOperations.isPresetAllowed(apiId, presetName);
          expect(isAllowed).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 3: 授权列表持久化往返**
   * **Validates: Requirements 2.4**
   * 
   * 预设授权往返：移除后检查应该返回 false
   */
  it("*For any* API ID and preset name, removing it then checking SHALL return false", async () => {
    await fc.assert(
      fc.asyncProperty(
        apiIdArb,
        presetNameArb,
        async (apiId, presetName) => {
          // 清空状态
          clearMockStore();
          
          // 先添加
          await AllowListOperations.allowPreset(apiId, presetName);
          
          // 再移除
          await AllowListOperations.disallowPreset(apiId, presetName);
          
          // 检查应该返回 false
          const isAllowed = await AllowListOperations.isPresetAllowed(apiId, presetName);
          expect(isAllowed).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 3: 授权列表持久化往返**
   * **Validates: Requirements 2.3, 2.4**
   * 
   * 幂等性：重复添加应该不影响结果
   */
  it("*For any* character ID, adding it multiple times SHALL be idempotent", async () => {
    await fc.assert(
      fc.asyncProperty(
        characterIdArb,
        fc.integer({ min: 1, max: 5 }),
        async (characterId, times) => {
          // 清空状态
          clearMockStore();
          
          // 重复添加多次
          for (let i = 0; i < times; i++) {
            await AllowListOperations.allowCharacter(characterId);
          }
          
          // 检查应该返回 true
          const isAllowed = await AllowListOperations.isCharacterAllowed(characterId);
          expect(isAllowed).toBe(true);
          
          // 获取列表，验证只有一个条目
          const allowList = await AllowListOperations.getAllowList();
          const count = allowList.characters.filter(id => id === characterId).length;
          expect(count).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 3: 授权列表持久化往返**
   * **Validates: Requirements 2.3, 2.4**
   * 
   * 幂等性：重复移除应该不影响结果
   */
  it("*For any* character ID, removing it multiple times SHALL be idempotent", async () => {
    await fc.assert(
      fc.asyncProperty(
        characterIdArb,
        fc.integer({ min: 1, max: 5 }),
        async (characterId, times) => {
          // 清空状态
          clearMockStore();
          
          // 先添加
          await AllowListOperations.allowCharacter(characterId);
          
          // 重复移除多次
          for (let i = 0; i < times; i++) {
            await AllowListOperations.disallowCharacter(characterId);
          }
          
          // 检查应该返回 false
          const isAllowed = await AllowListOperations.isCharacterAllowed(characterId);
          expect(isAllowed).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 3: 授权列表持久化往返**
   * **Validates: Requirements 2.3, 2.4**
   * 
   * 独立性：不同角色的授权状态应该独立
   */
  it("*For any* two different character IDs, their authorization states SHALL be independent", async () => {
    await fc.assert(
      fc.asyncProperty(
        characterIdArb,
        characterIdArb,
        async (charId1, charId2) => {
          // 确保两个 ID 不同
          fc.pre(charId1 !== charId2);
          
          // 清空状态
          clearMockStore();
          
          // 只授权第一个角色
          await AllowListOperations.allowCharacter(charId1);
          
          // 第一个应该被授权
          const isAllowed1 = await AllowListOperations.isCharacterAllowed(charId1);
          expect(isAllowed1).toBe(true);
          
          // 第二个不应该被授权
          const isAllowed2 = await AllowListOperations.isCharacterAllowed(charId2);
          expect(isAllowed2).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 3: 授权列表持久化往返**
   * **Validates: Requirements 2.3, 2.4**
   * 
   * 独立性：不同 API 的预设授权状态应该独立
   */
  it("*For any* two different API IDs with same preset name, their states SHALL be independent", async () => {
    await fc.assert(
      fc.asyncProperty(
        apiIdArb,
        apiIdArb,
        presetNameArb,
        async (apiId1, apiId2, presetName) => {
          // 确保两个 API ID 不同
          fc.pre(apiId1 !== apiId2);
          
          // 清空状态 - 确保每次迭代都从干净状态开始
          clearMockStore();
          
          // 只授权第一个 API 的预设
          await AllowListOperations.allowPreset(apiId1, presetName);
          
          // 第一个 API 的预设应该被授权
          const isAllowed1 = await AllowListOperations.isPresetAllowed(apiId1, presetName);
          expect(isAllowed1).toBe(true);
          
          // 第二个 API 的预设不应该被授权
          const isAllowed2 = await AllowListOperations.isPresetAllowed(apiId2, presetName);
          expect(isAllowed2).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
    
    // 测试结束后清空，确保不影响后续测试
    clearMockStore();
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 3: 授权列表持久化往返**
   * **Validates: Requirements 2.3, 2.4**
   * 
   * 批量操作：多个角色的授权状态应该正确维护
   */
  it("*For any* set of character IDs, adding them all then checking SHALL all return true", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(characterIdArb, { minLength: 1, maxLength: 10 }),
        async (characterIds) => {
          // 清空状态 - 确保每次迭代都从干净状态开始
          clearMockStore();
          
          // 验证清空后确实是空的
          const emptyList = await AllowListOperations.getAllowList();
          expect(emptyList.characters.length).toBe(0);
          
          // 去重
          const uniqueIds = Array.from(new Set(characterIds));
          
          // 添加所有角色
          for (const id of uniqueIds) {
            await AllowListOperations.allowCharacter(id);
          }
          
          // 检查所有角色都应该被授权
          for (const id of uniqueIds) {
            const isAllowed = await AllowListOperations.isCharacterAllowed(id);
            expect(isAllowed).toBe(true);
          }
          
          // 验证列表中的数量正确
          const allowList = await AllowListOperations.getAllowList();
          expect(allowList.characters.length).toBe(uniqueIds.length);
        },
      ),
      { numRuns: 100 },
    );
    
    // 测试结束后清空，确保不影响后续测试
    clearMockStore();
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 3: 授权列表持久化往返**
   * **Validates: Requirements 2.3, 2.4**
   * 
   * 混合操作：添加和移除操作应该正确反映最终状态
   */
  it("*For any* sequence of add/remove operations, final state SHALL match last operation", async () => {
    await fc.assert(
      fc.asyncProperty(
        characterIdArb,
        fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
        async (characterId, operations) => {
          // 清空状态
          clearMockStore();
          
          // 执行一系列添加/移除操作
          for (const shouldAdd of operations) {
            if (shouldAdd) {
              await AllowListOperations.allowCharacter(characterId);
            } else {
              await AllowListOperations.disallowCharacter(characterId);
            }
          }
          
          // 最终状态应该与最后一次操作一致
          const lastOperation = operations[operations.length - 1];
          const isAllowed = await AllowListOperations.isCharacterAllowed(characterId);
          expect(isAllowed).toBe(lastOperation);
        },
      ),
      { numRuns: 100 },
    );
    
    // 测试结束后清空，确保不影响后续测试
    clearMockStore();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   边界情况测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Edge Cases", () => {
  /**
   * 空授权列表：未添加的角色应该返回 false
   */
  it("character not in allow list SHALL return false", async () => {
    clearMockStore();
    const isAllowed = await AllowListOperations.isCharacterAllowed("char_123");
    expect(isAllowed).toBe(false);
  });

  /**
   * 空授权列表：未添加的预设应该返回 false
   */
  it("preset not in allow list SHALL return false", async () => {
    clearMockStore();
    const isAllowed = await AllowListOperations.isPresetAllowed("openai", "default");
    expect(isAllowed).toBe(false);
  });

  /**
   * 移除不存在的角色应该不报错
   */
  it("removing non-existent character SHALL not throw", async () => {
    clearMockStore();
    await expect(
      AllowListOperations.disallowCharacter("char_nonexistent"),
    ).resolves.not.toThrow();
  });

  /**
   * 移除不存在的预设应该不报错
   */
  it("removing non-existent preset SHALL not throw", async () => {
    clearMockStore();
    await expect(
      AllowListOperations.disallowPreset("openai", "nonexistent"),
    ).resolves.not.toThrow();
  });

  /**
   * 获取空授权列表应该返回空结构
   */
  it("getting empty allow list SHALL return empty structure", async () => {
    // 确保清空状态
    clearMockStore();
    
    const allowList = await AllowListOperations.getAllowList();
    
    expect(allowList.characters).toEqual([]);
    expect(allowList.presets).toEqual({});
  });

  /**
   * 同一 API 下的不同预设应该独立管理
   */
  it("different presets under same API SHALL be managed independently", async () => {
    clearMockStore();
    const apiId = "openai";
    const preset1 = "default";
    const preset2 = "creative";
    
    // 只授权第一个预设
    await AllowListOperations.allowPreset(apiId, preset1);
    
    // 第一个应该被授权
    expect(await AllowListOperations.isPresetAllowed(apiId, preset1)).toBe(true);
    
    // 第二个不应该被授权
    expect(await AllowListOperations.isPresetAllowed(apiId, preset2)).toBe(false);
  });

  /**
   * 移除 API 下的所有预设后，该 API 分组应该被清理
   */
  it("removing all presets under an API SHALL clean up the API group", async () => {
    // 确保清空状态
    clearMockStore();
    
    const apiId = "openai";
    const presetName = "default";
    
    // 添加预设
    await AllowListOperations.allowPreset(apiId, presetName);
    
    // 移除预设
    await AllowListOperations.disallowPreset(apiId, presetName);
    
    // 获取列表，验证 API 分组已被清理
    const allowList = await AllowListOperations.getAllowList();
    expect(allowList.presets[apiId]).toBeUndefined();
  });

  /**
   * 角色和预设的授权状态应该完全独立
   */
  it("character and preset authorization SHALL be completely independent", async () => {
    clearMockStore();
    const characterId = "char_123";
    const apiId = "openai";
    const presetName = "default";
    
    // 授权角色
    await AllowListOperations.allowCharacter(characterId);
    
    // 预设不应该被授权
    expect(await AllowListOperations.isPresetAllowed(apiId, presetName)).toBe(false);
    
    // 授权预设
    await AllowListOperations.allowPreset(apiId, presetName);
    
    // 角色仍然应该被授权
    expect(await AllowListOperations.isCharacterAllowed(characterId)).toBe(true);
  });
});
