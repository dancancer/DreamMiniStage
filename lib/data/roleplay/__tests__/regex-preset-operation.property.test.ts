/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║           Regex Preset Operations Property Tests                          ║
 * ║                                                                           ║
 * ║  **Feature: regex-sillytavern-compat, Property 7: 预设保存/加载往返一致性** ║
 * ║  **Validates: Requirements 6.1, 6.2**                                     ║
 * ║                                                                           ║
 * ║  验证预设操作的核心不变量：                                                 ║
 * ║  *For any* regex preset configuration with name, description, and         ║
 * ║  scriptStates, saving it and then loading it should return an equivalent  ║
 * ║  configuration with all fields preserved.                                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fc from "fast-check";
import { RegexPresetConfig } from "@/lib/models/regex-script-model";

/* ═══════════════════════════════════════════════════════════════════════════
   Mock 存储层
   使用内存 Map 模拟 IndexedDB 行为
   
   设计理念：容器模式 + 深拷贝隔离
   ═══════════════════════════════════════════════════════════════════════════ */

const mockStoreContainer = {
  store: new Map<string, RegexPresetConfig>(),
};

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function clearMockStore() {
  mockStoreContainer.store.clear();
}

vi.mock("@/lib/data/local-storage", () => ({
  REGEX_PRESETS_FILE: "regex_presets",
  getRecordByKey: async (store: string, key: string) => {
    if (store === "regex_presets") {
      const value = mockStoreContainer.store.get(key);
      return value ? deepClone(value) : null;
    }
    return null;
  },
  putRecord: async (store: string, key: string, value: RegexPresetConfig) => {
    if (store === "regex_presets") {
      mockStoreContainer.store.set(key, deepClone(value));
    }
  },
  deleteRecord: async (store: string, key: string) => {
    if (store === "regex_presets") {
      mockStoreContainer.store.delete(key);
    }
  },
  getAllEntries: async (store: string) => {
    if (store === "regex_presets") {
      const entries: Array<{ key: string; value: RegexPresetConfig }> = [];
      mockStoreContainer.store.forEach((value, key) => {
        entries.push({ key, value: deepClone(value) });
      });
      return entries;
    }
    return [];
  },
}));

// 动态导入以确保 mock 生效
const { RegexPresetOperations } = await import("../regex-preset-operation");

/* ═══════════════════════════════════════════════════════════════════════════
   测试环境设置
   ═══════════════════════════════════════════════════════════════════════════ */

beforeEach(() => {
  clearMockStore();
});

/* ═══════════════════════════════════════════════════════════════════════════
   生成器定义
   
   设计理念：智能生成器，约束输入空间
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 生成预设名称
 * 格式：字母数字下划线连字符，长度 1-50
 */
const presetNameArb = fc.stringMatching(/^[a-zA-Z0-9_-]+$/)
  .filter(s => s.length > 0 && s.length <= 50);

/**
 * 生成预设描述
 * 可选字段，可能为 undefined
 */
const descriptionArb = fc.option(
  fc.string({ minLength: 0, maxLength: 200 }),
  { nil: undefined },
);

/**
 * 生成时间戳
 * 范围：2020-01-01 到 2030-12-31
 */
const timestampArb = fc.integer({
  min: new Date("2020-01-01").getTime(),
  max: new Date("2030-12-31").getTime(),
});

/**
 * 生成脚本键
 * 格式：script_<number>
 */
const scriptKeyArb = fc.integer({ min: 0, max: 999 })
  .map(n => `script_${n}`);

/**
 * 生成脚本状态映射
 * Record<scriptKey, enabled>
 */
const scriptStatesArb = fc.dictionary(
  scriptKeyArb,
  fc.boolean(),
  { minKeys: 0, maxKeys: 20 },
);

/**
 * 生成完整的预设配置（不含 name）
 */
const presetConfigWithoutNameArb = fc.record({
  description: descriptionArb,
  createdAt: timestampArb,
  updatedAt: timestampArb,
  scriptStates: scriptStatesArb,
});

/**
 * 生成完整的预设配置（含 name）
 */
const presetConfigArb = fc.record({
  name: presetNameArb,
  description: descriptionArb,
  createdAt: timestampArb,
  updatedAt: timestampArb,
  scriptStates: scriptStatesArb,
});

/* ═══════════════════════════════════════════════════════════════════════════
   属性测试 - Property 7: 预设保存/加载往返一致性
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Property 7: 预设保存/加载往返一致性", () => {
  /**
   * **Feature: regex-sillytavern-compat, Property 7: 预设保存/加载往返一致性**
   * **Validates: Requirements 6.1, 6.2**
   * 
   * 核心往返属性：保存后加载应该得到相同的配置
   */
  it("*For any* preset config, saving then loading SHALL return equivalent config", async () => {
    await fc.assert(
      fc.asyncProperty(
        presetNameArb,
        presetConfigWithoutNameArb,
        async (name, config) => {
          clearMockStore();
          
          // 保存预设
          await RegexPresetOperations.savePreset(name, config);
          
          // 加载预设
          const loaded = await RegexPresetOperations.loadPreset(name);
          
          // 验证加载的配置与原始配置一致
          expect(loaded).not.toBeNull();
          expect(loaded?.name).toBe(name);
          expect(loaded?.description).toBe(config.description);
          expect(loaded?.createdAt).toBe(config.createdAt);
          expect(loaded?.updatedAt).toBe(config.updatedAt);
          expect(loaded?.scriptStates).toEqual(config.scriptStates);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 7: 预设保存/加载往返一致性**
   * **Validates: Requirements 6.1, 6.2**
   * 
   * 覆盖保存：同名预设应该被覆盖
   */
  it("*For any* preset name, saving twice SHALL overwrite the first save", async () => {
    await fc.assert(
      fc.asyncProperty(
        presetNameArb,
        presetConfigWithoutNameArb,
        presetConfigWithoutNameArb,
        async (name, config1, config2) => {
          clearMockStore();
          
          // 第一次保存
          await RegexPresetOperations.savePreset(name, config1);
          
          // 第二次保存（覆盖）
          await RegexPresetOperations.savePreset(name, config2);
          
          // 加载应该得到第二次保存的配置
          const loaded = await RegexPresetOperations.loadPreset(name);
          
          expect(loaded).not.toBeNull();
          expect(loaded?.description).toBe(config2.description);
          expect(loaded?.createdAt).toBe(config2.createdAt);
          expect(loaded?.updatedAt).toBe(config2.updatedAt);
          expect(loaded?.scriptStates).toEqual(config2.scriptStates);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 7: 预设保存/加载往返一致性**
   * **Validates: Requirements 6.1, 6.2**
   * 
   * 删除后加载：删除的预设应该返回 null
   */
  it("*For any* preset name, deleting then loading SHALL return null", async () => {
    await fc.assert(
      fc.asyncProperty(
        presetNameArb,
        presetConfigWithoutNameArb,
        async (name, config) => {
          clearMockStore();
          
          // 保存预设
          await RegexPresetOperations.savePreset(name, config);
          
          // 删除预设
          await RegexPresetOperations.deletePreset(name);
          
          // 加载应该返回 null
          const loaded = await RegexPresetOperations.loadPreset(name);
          expect(loaded).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 7: 预设保存/加载往返一致性**
   * **Validates: Requirements 6.1, 6.2**
   * 
   * 列表完整性：保存的所有预设都应该出现在列表中
   */
  it("*For any* set of presets, all saved presets SHALL appear in list", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(presetNameArb, presetConfigWithoutNameArb),
          { minLength: 1, maxLength: 10 },
        ),
        async (presets) => {
          clearMockStore();
          
          // 去重（同名预设只保留最后一个）
          const uniquePresets = new Map(presets);
          
          // 保存所有预设
          for (const [name, config] of uniquePresets) {
            await RegexPresetOperations.savePreset(name, config);
          }
          
          // 获取列表
          const list = await RegexPresetOperations.listPresets();
          
          // 验证数量
          expect(list.length).toBe(uniquePresets.size);
          
          // 验证所有预设都在列表中
          const listNames = new Set(list.map(p => p.name));
          for (const name of uniquePresets.keys()) {
            expect(listNames.has(name)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 7: 预设保存/加载往返一致性**
   * **Validates: Requirements 6.1, 6.2**
   * 
   * 独立性：不同预设的配置应该独立
   */
  it("*For any* two different preset names, their configs SHALL be independent", async () => {
    await fc.assert(
      fc.asyncProperty(
        presetNameArb,
        presetNameArb,
        presetConfigWithoutNameArb,
        presetConfigWithoutNameArb,
        async (name1, name2, config1, config2) => {
          // 确保两个名称不同
          fc.pre(name1 !== name2);
          
          clearMockStore();
          
          // 保存两个预设
          await RegexPresetOperations.savePreset(name1, config1);
          await RegexPresetOperations.savePreset(name2, config2);
          
          // 加载第一个预设
          const loaded1 = await RegexPresetOperations.loadPreset(name1);
          expect(loaded1?.scriptStates).toEqual(config1.scriptStates);
          
          // 加载第二个预设
          const loaded2 = await RegexPresetOperations.loadPreset(name2);
          expect(loaded2?.scriptStates).toEqual(config2.scriptStates);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 7: 预设保存/加载往返一致性**
   * **Validates: Requirements 6.1, 6.2**
   * 
   * 空脚本状态：空的 scriptStates 应该被正确保存和加载
   */
  it("*For any* preset with empty scriptStates, it SHALL be preserved", async () => {
    await fc.assert(
      fc.asyncProperty(
        presetNameArb,
        timestampArb,
        timestampArb,
        async (name, createdAt, updatedAt) => {
          clearMockStore();
          
          const config = {
            description: "Empty preset",
            createdAt,
            updatedAt,
            scriptStates: {},
          };
          
          // 保存预设
          await RegexPresetOperations.savePreset(name, config);
          
          // 加载预设
          const loaded = await RegexPresetOperations.loadPreset(name);
          
          // 验证空对象被保留
          expect(loaded?.scriptStates).toEqual({});
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Feature: regex-sillytavern-compat, Property 7: 预设保存/加载往返一致性**
   * **Validates: Requirements 6.1, 6.2**
   * 
   * 描述可选性：description 为 undefined 应该被正确处理
   */
  it("*For any* preset without description, it SHALL be preserved as undefined", async () => {
    await fc.assert(
      fc.asyncProperty(
        presetNameArb,
        timestampArb,
        timestampArb,
        scriptStatesArb,
        async (name, createdAt, updatedAt, scriptStates) => {
          clearMockStore();
          
          const config = {
            description: undefined,
            createdAt,
            updatedAt,
            scriptStates,
          };
          
          // 保存预设
          await RegexPresetOperations.savePreset(name, config);
          
          // 加载预设
          const loaded = await RegexPresetOperations.loadPreset(name);
          
          // 验证 undefined 被保留
          expect(loaded?.description).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   边界情况测试
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Edge Cases", () => {
  /**
   * 加载不存在的预设应该返回 null
   */
  it("loading non-existent preset SHALL return null", async () => {
    clearMockStore();
    const loaded = await RegexPresetOperations.loadPreset("nonexistent");
    expect(loaded).toBeNull();
  });

  /**
   * 删除不存在的预设应该不报错
   */
  it("deleting non-existent preset SHALL not throw", async () => {
    clearMockStore();
    await expect(
      RegexPresetOperations.deletePreset("nonexistent"),
    ).resolves.not.toThrow();
  });

  /**
   * 空列表：没有预设时应该返回空数组
   */
  it("listing presets when empty SHALL return empty array", async () => {
    clearMockStore();
    const list = await RegexPresetOperations.listPresets();
    expect(list).toEqual([]);
  });

  /**
   * 特殊字符：预设名称中的特殊字符应该被正确处理
   */
  it("preset name with special characters SHALL be handled correctly", async () => {
    clearMockStore();
    
    const specialNames = [
      "preset-with-dash",
      "preset_with_underscore",
      "preset123",
      "PRESET_UPPERCASE",
    ];
    
    for (const name of specialNames) {
      const config = {
        description: `Test ${name}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        scriptStates: { script_1: true },
      };
      
      await RegexPresetOperations.savePreset(name, config);
      const loaded = await RegexPresetOperations.loadPreset(name);
      
      expect(loaded?.name).toBe(name);
      expect(loaded?.description).toBe(config.description);
    }
  });

  /**
   * 大量脚本状态：大量的 scriptStates 应该被正确处理
   */
  it("preset with many scriptStates SHALL be handled correctly", async () => {
    clearMockStore();
    
    const name = "large-preset";
    const scriptStates: Record<string, boolean> = {};
    
    // 生成 100 个脚本状态
    for (let i = 0; i < 100; i++) {
      scriptStates[`script_${i}`] = i % 2 === 0;
    }
    
    const config = {
      description: "Large preset",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      scriptStates,
    };
    
    await RegexPresetOperations.savePreset(name, config);
    const loaded = await RegexPresetOperations.loadPreset(name);
    
    expect(loaded?.scriptStates).toEqual(scriptStates);
    expect(Object.keys(loaded?.scriptStates || {}).length).toBe(100);
  });

  /**
   * 时间戳边界：极端时间戳应该被正确处理
   */
  it("preset with extreme timestamps SHALL be handled correctly", async () => {
    clearMockStore();
    
    const name = "extreme-timestamps";
    const config = {
      description: "Extreme timestamps",
      createdAt: 0,
      updatedAt: Number.MAX_SAFE_INTEGER,
      scriptStates: { script_1: true },
    };
    
    await RegexPresetOperations.savePreset(name, config);
    const loaded = await RegexPresetOperations.loadPreset(name);
    
    expect(loaded?.createdAt).toBe(0);
    expect(loaded?.updatedAt).toBe(Number.MAX_SAFE_INTEGER);
  });

  /**
   * 长描述：很长的描述应该被正确处理
   */
  it("preset with long description SHALL be handled correctly", async () => {
    clearMockStore();
    
    const name = "long-description";
    const longDescription = "A".repeat(1000);
    const config = {
      description: longDescription,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      scriptStates: { script_1: true },
    };
    
    await RegexPresetOperations.savePreset(name, config);
    const loaded = await RegexPresetOperations.loadPreset(name);
    
    expect(loaded?.description).toBe(longDescription);
    expect(loaded?.description?.length).toBe(1000);
  });
});
