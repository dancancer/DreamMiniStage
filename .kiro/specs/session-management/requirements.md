# Requirements Document

## Introduction

本功能为 DreamMiniStage 应用的首页增加会话管理能力。当前首页仅展示品牌信息和跳转入口，缺乏实际功能价值。新功能将首页改造为会话管理中心，支持：
1. 显示进行中的会话列表
2. 新建会话入口（跳转到角色卡片选择）
3. 同一角色卡可创建多个独立会话
4. 用户可自定义会话名称
5. 用户可删除会话

## Glossary

- **Session（会话）**: 用户与某个角色卡之间的一次独立对话实例，包含完整的对话历史树
- **Character Card（角色卡）**: 定义角色属性、人设、开场白等信息的数据实体
- **Dialogue Tree（对话树）**: 存储会话中所有消息节点及其分支关系的数据结构
- **Session Store（会话存储）**: 管理所有会话元数据的 IndexedDB 存储
- **Home Page（首页）**: 应用的主入口页面，路由为 `/`

## Requirements

### Requirement 1

**User Story:** As a user, I want to see all my ongoing sessions on the home page, so that I can quickly resume any conversation.

#### Acceptance Criteria

1. WHEN the user visits the home page THEN the Session_Store SHALL retrieve and display all existing sessions as a list
2. WHEN sessions exist THEN the Home_Page SHALL display each session with its custom name, associated character name, character avatar, and last activity timestamp
3. WHEN no sessions exist THEN the Home_Page SHALL display an empty state with guidance to create a new session
4. WHEN the session list exceeds the viewport THEN the Home_Page SHALL provide scrollable access to all sessions

### Requirement 2

**User Story:** As a user, I want to create a new session from the home page, so that I can start a fresh conversation with any character.

#### Acceptance Criteria

1. WHEN the user clicks the "New Session" button THEN the Home_Page SHALL navigate to the character cards page
2. WHEN the user selects a character card THEN the Session_Store SHALL create a new session record linked to that character
3. WHEN a new session is created THEN the Session_Store SHALL generate a unique session ID and set a default name based on character name and creation timestamp
4. WHEN session creation completes THEN the Home_Page SHALL navigate to the chat interface for that session

### Requirement 3

**User Story:** As a user, I want to have multiple sessions with the same character, so that I can explore different conversation paths or scenarios.

#### Acceptance Criteria

1. WHEN the user creates a session for a character THEN the Session_Store SHALL allow creation regardless of existing sessions for that character
2. WHEN multiple sessions exist for one character THEN the Home_Page SHALL display each session as a distinct entry in the session list
3. WHEN the user opens a session THEN the Dialogue_Store SHALL load only the dialogue tree associated with that specific session

### Requirement 4

**User Story:** As a user, I want to give each session a custom name, so that I can easily identify and organize my conversations.

#### Acceptance Criteria

1. WHEN a session is created THEN the Session_Store SHALL assign a default name in the format "{CharacterName} - {Timestamp}"
2. WHEN the user edits a session name THEN the Session_Store SHALL validate that the name is non-empty after trimming whitespace
3. WHEN the user submits a valid session name THEN the Session_Store SHALL persist the updated name immediately
4. WHEN the session name is updated THEN the Home_Page SHALL reflect the change without requiring a page refresh

### Requirement 5

**User Story:** As a user, I want to delete sessions I no longer need, so that I can keep my session list organized.

#### Acceptance Criteria

1. WHEN the user initiates session deletion THEN the Home_Page SHALL display a confirmation dialog
2. WHEN the user confirms deletion THEN the Session_Store SHALL remove the session record and its associated dialogue tree
3. WHEN deletion completes THEN the Home_Page SHALL remove the session from the displayed list without requiring a page refresh
4. WHEN the user cancels deletion THEN the Home_Page SHALL close the dialog and preserve the session

### Requirement 6

**User Story:** As a user, I want to click on a session to continue the conversation, so that I can seamlessly resume where I left off.

#### Acceptance Criteria

1. WHEN the user clicks on a session entry THEN the Home_Page SHALL navigate to the chat interface with the session ID as a parameter
2. WHEN the chat interface loads THEN the Dialogue_Store SHALL retrieve the dialogue tree using the session ID
3. WHEN the dialogue tree loads THEN the Chat_Interface SHALL display all messages from the current branch path

### Requirement 7

**User Story:** As a developer, I want session data to be serialized and deserialized correctly, so that sessions persist across browser refreshes and data exports.

#### Acceptance Criteria

1. WHEN a session is created or updated THEN the Session_Store SHALL serialize the session data to IndexedDB
2. WHEN the application loads THEN the Session_Store SHALL deserialize all session records from IndexedDB
3. WHEN exporting application data THEN the Export_Function SHALL include all session records in the backup
4. WHEN importing application data THEN the Import_Function SHALL restore all session records from the backup
5. WHEN serializing a session THEN the Session_Store SHALL produce valid JSON that can be deserialized to an equivalent session object
