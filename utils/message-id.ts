/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                         Message ID Generator                               ║
 * ║                                                                            ║
 * ║  消息唯一标识生成器：确保每条消息都有独特的身份                              ║
 * ║  设计原则：简洁、可预测、可调试                                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { v4 as uuidv4 } from "uuid";

// ============================================================================
//                              类型定义
// ============================================================================

export type MessageRole = "user" | "assistant" | "system" | "sample";

export interface MessageIdContext {
  nodeId: string;
  role: MessageRole;
  timestamp?: number;
}

// ============================================================================
//                              核心函数
// ============================================================================

/**
 * 生成消息唯一标识
 * 
 * 策略：nodeId + role 后缀，确保同一节点的不同角色消息有不同ID
 * 
 * @param context - 消息上下文信息
 * @returns 唯一的消息ID
 */
export function generateMessageId(context: MessageIdContext): string {
  const { nodeId, role } = context;
  
  // 使用节点ID + 角色后缀的方式，保持可读性和唯一性
  return `${nodeId}-${role}`;
}

/**
 * 生成完全独立的消息ID
 * 
 * 用于需要完全独立标识的场景（如实时消息流）
 * 
 * @param prefix - ID前缀，默认为 "msg"
 * @returns 全新的UUID
 */
export function generateUniqueMessageId(prefix: string = "msg"): string {
  return `${prefix}-${uuidv4()}`;
}

/**
 * 验证消息ID的有效性
 * 
 * @param messageId - 待验证的消息ID
 * @returns 是否为有效的消息ID
 */
export function isValidMessageId(messageId: string): boolean {
  if (!messageId || typeof messageId !== "string") {
    return false;
  }
  
  // 检查基本格式：至少包含一个连字符
  return messageId.includes("-") && messageId.length > 3;
}

/**
 * 从消息ID中提取角色信息
 * 
 * @param messageId - 消息ID
 * @returns 消息角色，如果无法提取则返回null
 */
export function extractRoleFromMessageId(messageId: string): MessageRole | null {
  if (!isValidMessageId(messageId)) {
    return null;
  }
  
  const parts = messageId.split("-");
  const lastPart = parts[parts.length - 1];
  
  if (["user", "assistant", "system", "sample"].includes(lastPart)) {
    return lastPart as MessageRole;
  }
  
  return null;
}