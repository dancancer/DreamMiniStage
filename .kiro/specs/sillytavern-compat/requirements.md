# Requirements Document

## Introduction

本文档定义了 DreamMiniStage 系统对 SillyTavern 接口兼容性的需求规范。目标是让现有的 SillyTavern 脚本（特别是 JS-Slash-Runner 插件生态中的脚本）能够在 DreamMiniStage 中无缝运行，同时保持系统架构的简洁性。

基于对 SillyTavern 代码库和 JS-Slash-Runner 插件的分析，我们识别出以下核心功能模块需要支持：

1. **Slash Commands 系统** - 命令解析与执行
2. **变量系统** - 全局/本地/聊天变量管理
3. **事件系统** - 生命周期事件订阅与发射
4. **Worldbook/Lorebook API** - 世界书条目管理
5. **消息操作 API** - 聊天消息的 CRUD 操作
6. **生成控制 API** - LLM 生成的启动/停止/流式控制
7. **Quick Reply 触发** - 快速回复的程序化触发

## Glossary

- **SillyTavern**: 一个流行的 AI 角色扮演前端应用
- **JS-Slash-Runner**: SillyTavern 的脚本运行插件，提供 TavernHelper API
- **TavernHelper**: JS-Slash-Runner 暴露给 iframe 脚本的全局 API 对象
- **Slash Command**: 以 `/` 开头的命令字符串，如 `/send Hello`
- **Worldbook**: SillyTavern 的世界设定系统，也称为 Lorebook
- **Quick Reply**: SillyTavern 的快速回复功能，可绑定脚本
- **Script Bridge**: DreamMiniStage 中连接 iframe 脚本与主应用的通信层
- **triggerSlash**: 执行 Slash 命令的核心函数

## Requirements

### Requirement 1: Slash Command 执行

**User Story:** As a script developer, I want to execute Slash commands programmatically, so that I can trigger chat actions from my scripts.

#### Acceptance Criteria

1. WHEN a script calls `triggerSlash("/send Hello")` THEN the System SHALL parse the command and execute the corresponding action
2. WHEN a script calls `triggerSlash` with a piped command like `/send Hello|/trigger` THEN the System SHALL execute commands sequentially and pass results through the pipe
3. WHEN a Slash command execution fails THEN the System SHALL return an error object with `isError: true` and `errorMessage` containing the failure reason
4. WHEN a Slash command completes successfully THEN the System SHALL return the command result in the `pipe` field
5. IF an invalid command is provided THEN the System SHALL reject with a descriptive error message

### Requirement 2: 变量系统

**User Story:** As a script developer, I want to read and write variables, so that I can persist state across script executions.

#### Acceptance Criteria

1. WHEN a script calls `getVariables()` THEN the System SHALL return an object containing all accessible variables (global and character-scoped)
2. WHEN a script calls `replaceVariables(vars)` THEN the System SHALL replace all variables with the provided object
3. WHEN a script calls `insertOrAssignVariables(vars)` THEN the System SHALL merge the provided variables with existing ones
4. WHEN a script calls `deleteVariable(key)` THEN the System SHALL remove the specified variable from storage
5. WHEN variables are modified THEN the System SHALL persist changes to localStorage immediately

### Requirement 3: 事件系统

**User Story:** As a script developer, I want to subscribe to system events, so that I can react to chat lifecycle changes.

#### Acceptance Criteria

1. WHEN a script calls `eventOn(eventType, handler)` THEN the System SHALL register the handler for the specified event type
2. WHEN a script calls `eventOnce(eventType, handler)` THEN the System SHALL register a one-time handler that auto-removes after first invocation
3. WHEN a script calls `eventEmit(eventType, data)` THEN the System SHALL dispatch the event to all registered handlers
4. WHEN a script calls `eventRemoveListener(eventType, handler)` THEN the System SHALL unregister the specified handler
5. WHEN an iframe is destroyed THEN the System SHALL automatically clean up all event listeners registered by that iframe

### Requirement 4: 消息操作 API

**User Story:** As a script developer, I want to manipulate chat messages, so that I can create interactive experiences.

#### Acceptance Criteria

1. WHEN a script calls `getChatMessages()` THEN the System SHALL return an array of all messages in the current chat
2. WHEN a script calls `setChatMessages(messages)` THEN the System SHALL update the specified messages in the chat
3. WHEN a script calls `createChatMessages(messages)` THEN the System SHALL append new messages to the chat
4. WHEN a script calls `deleteChatMessages(messageIds)` THEN the System SHALL remove the specified messages from the chat
5. WHEN a script calls `getCurrentMessageId()` THEN the System SHALL return the ID of the most recent message

### Requirement 5: Worldbook/Lorebook API

**User Story:** As a script developer, I want to manage Worldbook entries, so that I can dynamically control world information.

#### Acceptance Criteria

1. WHEN a script calls `getWorldbookNames()` THEN the System SHALL return an array of all available Worldbook names
2. WHEN a script calls `getLorebookEntries(worldbookName)` THEN the System SHALL return all entries from the specified Worldbook
3. WHEN a script calls `createLorebookEntry(worldbookName, entry)` THEN the System SHALL add a new entry to the Worldbook
4. WHEN a script calls `deleteLorebookEntry(worldbookName, entryId)` THEN the System SHALL remove the entry from the Worldbook
5. WHEN a script calls `updateLorebookEntriesWith(worldbookName, updates)` THEN the System SHALL apply partial updates to matching entries

### Requirement 6: 生成控制 API

**User Story:** As a script developer, I want to control LLM generation, so that I can create custom generation workflows.

#### Acceptance Criteria

1. WHEN a script calls `generate(options)` THEN the System SHALL initiate an LLM generation with the specified options
2. WHEN a script calls `generateRaw(prompt)` THEN the System SHALL send the raw prompt to the LLM without preprocessing
3. WHEN a script calls `stopGenerationById(generationId)` THEN the System SHALL abort the specified generation
4. WHEN a script calls `stopAllGeneration()` THEN the System SHALL abort all ongoing generations
5. WHEN generation produces streaming tokens THEN the System SHALL emit `STREAM_TOKEN_RECEIVED` events with the token data

### Requirement 7: Preset API

**User Story:** As a script developer, I want to manage presets, so that I can switch between different prompt configurations.

#### Acceptance Criteria

1. WHEN a script calls `getPresetNames()` THEN the System SHALL return an array of all available preset names
2. WHEN a script calls `getPreset(name)` THEN the System SHALL return the full preset configuration object
3. WHEN a script calls `loadPreset(name)` THEN the System SHALL activate the specified preset for subsequent generations
4. WHEN a script calls `createPreset(name, config)` THEN the System SHALL create a new preset with the given configuration
5. WHEN a script calls `deletePreset(name)` THEN the System SHALL remove the preset from storage

### Requirement 8: Quick Reply 触发

**User Story:** As a script developer, I want to trigger Quick Replies programmatically, so that I can automate common chat actions.

#### Acceptance Criteria

1. WHEN a script calls `triggerSlash("/send text|/trigger")` THEN the System SHALL send the message and trigger the generation
2. WHEN the text parameter is empty or contains only ellipsis THEN the System SHALL skip the send action
3. WHEN the `/trigger` command is executed THEN the System SHALL initiate an AI response generation
4. WHEN Quick Reply execution completes THEN the System SHALL return control to the calling script

### Requirement 9: TavernHelper 兼容层

**User Story:** As a script developer, I want my existing SillyTavern scripts to work without modification, so that I can migrate easily.

#### Acceptance Criteria

1. WHEN an iframe script accesses `window.TavernHelper` THEN the System SHALL provide a compatible API object
2. WHEN an iframe script accesses `window.SillyTavern.getContext()` THEN the System SHALL return a context object with current session information
3. WHEN an iframe script calls any TavernHelper method THEN the System SHALL route the call to the appropriate DreamMiniStage handler
4. WHEN a TavernHelper method is not implemented THEN the System SHALL log a warning and return a sensible default value
5. WHEN the iframe loads THEN the System SHALL inject the compatibility shim before any user scripts execute
