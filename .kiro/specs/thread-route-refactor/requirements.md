# Requirements Document

## Introduction

本功能将聊天界面的路由从 `/character` 重构为 `/session`。这一变更的目的是：
1. 语义更准确：`/session` 表示"会话"，与 session-management 功能保持一致
2. 与 session-management 功能对齐：会话（session）是核心实体，路由应反映这一关系
3. 解耦角色与对话：一个角色可以有多个会话，路由应反映这一关系

## Glossary

- **Session（会话）**: 用户与角色之间的一次独立对话实例
- **Character Route（角色路由）**: 当前的 `/character` 路由，将被废弃
- **Session Route（会话路由）**: 新的 `/session` 路由，用于承载聊天界面
- **Session ID**: 会话的唯一标识符，作为路由参数传递

## Requirements

### Requirement 1

**User Story:** As a user, I want to access chat conversations via the `/session` route, so that the URL semantically reflects that I am viewing a session.

#### Acceptance Criteria

1. WHEN the user navigates to `/session?id={sessionId}` THEN the Session_Page SHALL load the chat interface for the specified session
2. WHEN the id parameter is missing THEN the Session_Page SHALL redirect to the home page
3. WHEN the sessionId does not exist in storage THEN the Session_Page SHALL display an error message and provide navigation back to home

### Requirement 2

**User Story:** As a user, I want existing `/character` links to continue working, so that my bookmarks and shared links remain functional.

#### Acceptance Criteria

1. WHEN the user navigates to `/character?sessionId={id}` THEN the Character_Route SHALL redirect to `/session?id={id}`
2. WHEN the user navigates to `/character?id={characterId}` (legacy format) THEN the Character_Route SHALL redirect to the home page with a toast notification explaining the change
3. WHEN redirecting THEN the Character_Route SHALL use HTTP 308 permanent redirect semantics

### Requirement 3

**User Story:** As a developer, I want all internal navigation to use the new `/session` route, so that the codebase is consistent.

#### Acceptance Criteria

1. WHEN a session is created from the home page THEN the Navigation_Logic SHALL redirect to `/session?id={sessionId}`
2. WHEN a session card is clicked THEN the Navigation_Logic SHALL navigate to `/session?id={sessionId}`
3. WHEN the character-cards page creates a new session THEN the Navigation_Logic SHALL redirect to `/session?id={sessionId}`

### Requirement 4

**User Story:** As a developer, I want the `/character` route to be deprecated but not removed, so that we maintain backward compatibility during the transition period.

#### Acceptance Criteria

1. WHEN the `/character` route is accessed THEN the Character_Route SHALL log a deprecation warning to the console
2. WHEN the codebase is searched for `/character` navigation THEN the Search_Result SHALL show only the redirect handler, not direct usage
