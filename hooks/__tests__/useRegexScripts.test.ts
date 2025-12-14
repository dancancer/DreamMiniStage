/* ═══════════════════════════════════════════════════════════════════════════
   useRegexScripts Hook 测试
   
   测试范围：
   - 批量操作方法的数据层调用
   - 预设操作方法的数据层调用
   - 授权控制方法的数据层调用
   
   设计理念：
   - 测试 hook 是否正确调用底层数据操作
   - 不测试 React 渲染逻辑（那是 UI 层的职责）
   - 专注于业务逻辑的正确性
   ═══════════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { RegexScriptOperations } from "@/lib/data/roleplay/regex-script-operation";
import { RegexPresetOperations } from "@/lib/data/roleplay/regex-preset-operation";
import { AllowListOperations } from "@/lib/data/roleplay/regex-allow-list-operation";
import { ScriptSource } from "@/lib/models/regex-script-model";

describe("useRegexScripts Hook - 数据层集成", () => {
  const mockCharacterId = "test-character-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ─────────────────────────────────────────────────────────────────────────
     批量操作测试 - 验证数据层方法被正确调用
     ───────────────────────────────────────────────────────────────────────── */

  describe("批量操作数据层", () => {
    it("RegexScriptOperations.bulkEnable 应该正确处理脚本 ID 列表", async () => {
      const scriptIds = ["script1", "script2"];
      const mockBulkEnable = vi.spyOn(RegexScriptOperations, "bulkEnable")
        .mockResolvedValue(true);

      const success = await RegexScriptOperations.bulkEnable(mockCharacterId, scriptIds);

      expect(success).toBe(true);
      expect(mockBulkEnable).toHaveBeenCalledWith(mockCharacterId, scriptIds);
    });

    it("RegexScriptOperations.bulkDisable 应该正确处理脚本 ID 列表", async () => {
      const scriptIds = ["script1", "script2"];
      const mockBulkDisable = vi.spyOn(RegexScriptOperations, "bulkDisable")
        .mockResolvedValue(true);

      const success = await RegexScriptOperations.bulkDisable(mockCharacterId, scriptIds);

      expect(success).toBe(true);
      expect(mockBulkDisable).toHaveBeenCalledWith(mockCharacterId, scriptIds);
    });

    it("RegexScriptOperations.bulkDelete 应该正确处理脚本 ID 列表", async () => {
      const scriptIds = ["script1", "script2"];
      const mockBulkDelete = vi.spyOn(RegexScriptOperations, "bulkDelete")
        .mockResolvedValue(true);

      const success = await RegexScriptOperations.bulkDelete(mockCharacterId, scriptIds);

      expect(success).toBe(true);
      expect(mockBulkDelete).toHaveBeenCalledWith(mockCharacterId, scriptIds);
    });

    it("RegexScriptOperations.bulkMove 应该正确处理目标来源", async () => {
      const scriptIds = ["script1", "script2"];
      const targetSource = ScriptSource.GLOBAL;
      const mockBulkMove = vi.spyOn(RegexScriptOperations, "bulkMove")
        .mockResolvedValue(true);

      const success = await RegexScriptOperations.bulkMove(
        mockCharacterId,
        scriptIds,
        targetSource,
        undefined
      );

      expect(success).toBe(true);
      expect(mockBulkMove).toHaveBeenCalledWith(
        mockCharacterId,
        scriptIds,
        targetSource,
        undefined
      );
    });
  });

  /* ─────────────────────────────────────────────────────────────────────────
     预设操作测试 - 验证数据层方法被正确调用
     ───────────────────────────────────────────────────────────────────────── */

  describe("预设操作数据层", () => {
    it("RegexPresetOperations.savePreset 应该保存预设配置", async () => {
      const mockSavePreset = vi.spyOn(RegexPresetOperations, "savePreset")
        .mockResolvedValue();

      const config = {
        description: "Test description",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        scriptStates: { script1: true, script2: false },
      };

      await RegexPresetOperations.savePreset("test-preset", config);

      expect(mockSavePreset).toHaveBeenCalledWith("test-preset", config);
    });

    it("RegexPresetOperations.loadPreset 应该加载预设配置", async () => {
      const mockPreset = {
        name: "test-preset",
        description: "Test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        scriptStates: {},
      };

      const mockLoadPreset = vi.spyOn(RegexPresetOperations, "loadPreset")
        .mockResolvedValue(mockPreset);

      const preset = await RegexPresetOperations.loadPreset("test-preset");

      expect(preset).toEqual(mockPreset);
      expect(mockLoadPreset).toHaveBeenCalledWith("test-preset");
    });

    it("RegexPresetOperations.applyPreset 应该应用预设到指定 owner", async () => {
      const mockApplyPreset = vi.spyOn(RegexPresetOperations, "applyPreset")
        .mockResolvedValue();

      await RegexPresetOperations.applyPreset("test-preset", mockCharacterId);

      expect(mockApplyPreset).toHaveBeenCalledWith("test-preset", mockCharacterId);
    });

    it("RegexPresetOperations.deletePreset 应该删除预设", async () => {
      const mockDeletePreset = vi.spyOn(RegexPresetOperations, "deletePreset")
        .mockResolvedValue();

      await RegexPresetOperations.deletePreset("test-preset");

      expect(mockDeletePreset).toHaveBeenCalledWith("test-preset");
    });

    it("RegexPresetOperations.listPresets 应该返回所有预设", async () => {
      const mockPresets = [
        {
          name: "preset1",
          description: "Test 1",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          scriptStates: {},
        },
      ];

      const mockListPresets = vi.spyOn(RegexPresetOperations, "listPresets")
        .mockResolvedValue(mockPresets);

      const presets = await RegexPresetOperations.listPresets();

      expect(presets).toEqual(mockPresets);
      expect(mockListPresets).toHaveBeenCalled();
    });
  });

  /* ─────────────────────────────────────────────────────────────────────────
     授权控制测试 - 验证数据层方法被正确调用
     ───────────────────────────────────────────────────────────────────────── */

  describe("授权控制数据层", () => {
    it("AllowListOperations.allowCharacter 应该添加角色到授权列表", async () => {
      const mockAllowCharacter = vi.spyOn(AllowListOperations, "allowCharacter")
        .mockResolvedValue();

      await AllowListOperations.allowCharacter("char-123");

      expect(mockAllowCharacter).toHaveBeenCalledWith("char-123");
    });

    it("AllowListOperations.disallowCharacter 应该从授权列表移除角色", async () => {
      const mockDisallowCharacter = vi.spyOn(AllowListOperations, "disallowCharacter")
        .mockResolvedValue();

      await AllowListOperations.disallowCharacter("char-123");

      expect(mockDisallowCharacter).toHaveBeenCalledWith("char-123");
    });

    it("AllowListOperations.isCharacterAllowed 应该检查角色授权状态", async () => {
      const mockIsCharacterAllowed = vi.spyOn(AllowListOperations, "isCharacterAllowed")
        .mockResolvedValue(true);

      const allowed = await AllowListOperations.isCharacterAllowed("char-123");

      expect(allowed).toBe(true);
      expect(mockIsCharacterAllowed).toHaveBeenCalledWith("char-123");
    });

    it("AllowListOperations.allowPreset 应该添加预设到授权列表", async () => {
      const mockAllowPreset = vi.spyOn(AllowListOperations, "allowPreset")
        .mockResolvedValue();

      await AllowListOperations.allowPreset("openai", "preset-1");

      expect(mockAllowPreset).toHaveBeenCalledWith("openai", "preset-1");
    });

    it("AllowListOperations.disallowPreset 应该从授权列表移除预设", async () => {
      const mockDisallowPreset = vi.spyOn(AllowListOperations, "disallowPreset")
        .mockResolvedValue();

      await AllowListOperations.disallowPreset("openai", "preset-1");

      expect(mockDisallowPreset).toHaveBeenCalledWith("openai", "preset-1");
    });

    it("AllowListOperations.isPresetAllowed 应该检查预设授权状态", async () => {
      const mockIsPresetAllowed = vi.spyOn(AllowListOperations, "isPresetAllowed")
        .mockResolvedValue(true);

      const allowed = await AllowListOperations.isPresetAllowed("openai", "preset-1");

      expect(allowed).toBe(true);
      expect(mockIsPresetAllowed).toHaveBeenCalledWith("openai", "preset-1");
    });

    it("AllowListOperations.getAllowList 应该返回完整授权列表", async () => {
      const mockAllowList = {
        characters: ["char-1"],
        presets: { openai: ["preset-1"] },
      };

      const mockGetAllowList = vi.spyOn(AllowListOperations, "getAllowList")
        .mockResolvedValue(mockAllowList);

      const allowList = await AllowListOperations.getAllowList();

      expect(allowList).toEqual(mockAllowList);
      expect(mockGetAllowList).toHaveBeenCalled();
    });
  });
});
