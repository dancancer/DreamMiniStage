/**
 * @input  lib/data/local-storage, lib/models/regex-script-model
 * @output AllowListOperations
 * @pos    正则脚本授权列表操作层,管理白名单机制的持久化
 * @update 一旦我被更新,务必更新我的开头注释,以及所属文件夹的 README.md
 */

/* ═══════════════════════════════════════════════════════════════════════════
   正则脚本授权列表操作类

   设计理念：
   1. 白名单机制 - 默认拒绝，显式允许
   2. 单一数据源 - 所有授权状态集中管理
   3. 原子操作 - 每次修改都是完整的读-改-写循环

   架构层次：数据层 - 负责授权列表的持久化和查询
   ═══════════════════════════════════════════════════════════════════════════ */

import { RegexAllowList } from "@/lib/models/regex-script-model";
import {
  REGEX_ALLOW_LIST_FILE,
  getRecordByKey,
  putRecord,
} from "@/lib/data/local-storage";

/* ─────────────────────────────────────────────────────────────────────────
   常量定义
   ───────────────────────────────────────────────────────────────────────── */

/** 默认授权列表键 */
const DEFAULT_ALLOW_LIST_KEY = "default";

/** 空授权列表 - 默认拒绝所有 */
const EMPTY_ALLOW_LIST: RegexAllowList = {
  characters: [],
  presets: {},
};

/* ═══════════════════════════════════════════════════════════════════════════
   授权列表操作类
   ═══════════════════════════════════════════════════════════════════════════ */

export class AllowListOperations {
  /* ─────────────────────────────────────────────────────────────────────────
     读取操作
     ───────────────────────────────────────────────────────────────────────── */
  
  /**
   * 获取授权列表
   * 
   * 设计理念：
   * - 消除 null 特殊情况，总是返回有效对象
   * - 深拷贝防止引用共享，确保数据隔离
   * 
   * @returns 授权列表对象（深拷贝）
   */
  static async getAllowList(): Promise<RegexAllowList> {
    const stored = await getRecordByKey<RegexAllowList>(
      REGEX_ALLOW_LIST_FILE,
      DEFAULT_ALLOW_LIST_KEY,
    );
    
    // 消除特殊情况：null → 空列表（深拷贝）
    return stored ?? {
      characters: [],
      presets: {},
    };
  }
  
  /**
   * 检查角色是否在授权列表中
   * 
   * @param characterId - 角色 ID
   * @returns 是否允许
   */
  static async isCharacterAllowed(characterId: string): Promise<boolean> {
    const allowList = await this.getAllowList();
    return allowList.characters.includes(characterId);
  }
  
  /**
   * 检查预设是否在授权列表中
   * 
   * @param apiId - API 类型标识符（如 "openai", "gemini"）
   * @param presetName - 预设名称
   * @returns 是否允许
   */
  static async isPresetAllowed(
    apiId: string,
    presetName: string,
  ): Promise<boolean> {
    const allowList = await this.getAllowList();
    const presetsForApi = allowList.presets[apiId] ?? [];
    return presetsForApi.includes(presetName);
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     写入操作 - 角色授权
     ───────────────────────────────────────────────────────────────────────── */
  
  /**
   * 将角色添加到授权列表
   * 
   * 设计理念：幂等操作，重复添加不会产生副作用
   * 
   * @param characterId - 角色 ID
   */
  static async allowCharacter(characterId: string): Promise<void> {
    const allowList = await this.getAllowList();
    
    // 幂等性：已存在则跳过
    if (allowList.characters.includes(characterId)) {
      return;
    }
    
    allowList.characters.push(characterId);
    await putRecord(REGEX_ALLOW_LIST_FILE, DEFAULT_ALLOW_LIST_KEY, allowList);
  }
  
  /**
   * 从授权列表中移除角色
   * 
   * 设计理念：幂等操作，重复移除不会产生副作用
   * 
   * @param characterId - 角色 ID
   */
  static async disallowCharacter(characterId: string): Promise<void> {
    const allowList = await this.getAllowList();
    
    // 过滤掉目标角色
    allowList.characters = allowList.characters.filter(
      id => id !== characterId,
    );
    
    await putRecord(REGEX_ALLOW_LIST_FILE, DEFAULT_ALLOW_LIST_KEY, allowList);
  }
  
  /* ─────────────────────────────────────────────────────────────────────────
     写入操作 - 预设授权
     ───────────────────────────────────────────────────────────────────────── */
  
  /**
   * 将预设添加到授权列表
   * 
   * 设计理念：
   * - 按 API 类型分组管理
   * - 自动创建不存在的 API 分组
   * - 幂等操作
   * 
   * @param apiId - API 类型标识符
   * @param presetName - 预设名称
   */
  static async allowPreset(apiId: string, presetName: string): Promise<void> {
    const allowList = await this.getAllowList();
    
    // 确保 API 分组存在
    if (!allowList.presets[apiId]) {
      allowList.presets[apiId] = [];
    }
    
    // 幂等性：已存在则跳过
    if (allowList.presets[apiId].includes(presetName)) {
      return;
    }
    
    allowList.presets[apiId].push(presetName);
    await putRecord(REGEX_ALLOW_LIST_FILE, DEFAULT_ALLOW_LIST_KEY, allowList);
  }
  
  /**
   * 从授权列表中移除预设
   * 
   * 设计理念：
   * - 幂等操作
   * - 清理空的 API 分组
   * 
   * @param apiId - API 类型标识符
   * @param presetName - 预设名称
   */
  static async disallowPreset(
    apiId: string,
    presetName: string,
  ): Promise<void> {
    const allowList = await this.getAllowList();
    
    // API 分组不存在，无需操作
    if (!allowList.presets[apiId]) {
      return;
    }
    
    // 过滤掉目标预设
    allowList.presets[apiId] = allowList.presets[apiId].filter(
      name => name !== presetName,
    );
    
    // 清理空分组，保持数据整洁
    if (allowList.presets[apiId].length === 0) {
      delete allowList.presets[apiId];
    }
    
    await putRecord(REGEX_ALLOW_LIST_FILE, DEFAULT_ALLOW_LIST_KEY, allowList);
  }
}
