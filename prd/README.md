# DreamMiniStage PRD

> 生成方式：使用 `code-to-prd` skill 进行静态扫描与 scaffold，再基于当前源码人工校准。
> 更新时间：2026-05-22

## 1. 产品摘要

DreamMiniStage 是一个本地优先的沉浸式叙事舞台。用户导入角色卡，创建独立会话，在聊天中通过世界书、预设、正则、Persona、slash command、脚本桥和插件扩展控制叙事上下文。

当前仓库没有传统业务后端路由；主要数据存储在浏览器 IndexedDB。外部服务仅在明确触发时调用：LLM、Google Drive、Jina Reader、插件宿主、analytics。

## 2. 真实业务路由

| 路由 | 页面文档 | 用户价值 |
|------|----------|----------|
| `/` | [01 Home Session List](pages/01-home-session-list.md) | 继续或管理已有会话 |
| `/character-cards` | [02 Character Cards](pages/02-character-cards.md) | 导入/管理角色卡，创建会话 |
| `/personas` | [03 Personas](pages/03-personas.md) | 管理用户身份与注入配置 |
| `/session?id={sessionId}` | [04 Session Chat](pages/04-session-chat.md) | 叙事聊天主舞台 |
| `/session?id={sessionId}` view=`worldbook` | [05 Session Worldbook](pages/05-session-worldbook.md) | 编辑角色/会话/全局世界书 |
| `/session?id={sessionId}` view=`preset` | [06 Session Preset](pages/06-session-preset.md) | 管理全局 prompt 预设 |
| `/session?id={sessionId}` view=`regex` | [07 Session Regex](pages/07-session-regex.md) | 管理正则脚本与规则工作区 |
| 全局右侧抽屉 | [08 Right Panels](pages/08-right-panels.md) | 收纳低频工具和设置 |
| `/test-script-runner` | [09 Test Script Runner](pages/09-test-script-runner.md) | 内部 P4 脚本链路诊断 |

`app/i18n/*`、`app/layout.tsx`、`app/metadata.ts`、`not-found` 属于基础设施，不作为业务页面拆 PRD。

## 3. 业务模块

| 模块 | 当前能力 |
|------|----------|
| 会话 | 列表、创建、打开、重命名、删除、会话级 dialogue tree |
| 角色卡 | PNG 导入、编辑、删除、置顶、列表/轮播视图 |
| Persona | CRUD、默认、激活、头像、描述注入、导出 |
| 聊天 | 开场白、消息发送、再生、swipe、隐藏、JSONL、Prompt Viewer |
| 世界书 | 角色级、会话级、全局级条目编辑与导入 |
| 预设 | OpenAI preset、context preset、sysprompt、sampling、prompt order |
| 正则 | 全局/角色/预设来源、placement、授权、预设状态 |
| Slash/Script | 464 个命令/别名、iframe API、function tool、host bridge |
| 插件 | registry 读取、启用/禁用、刷新发现 |
| 数据 | IndexedDB 本地持久化、JSON 导入导出、Google Drive 同步 |

## 4. 全局业务规则

- 默认本地优先：角色、会话、世界书、预设、正则、Persona 都保存在浏览器本地。
- LLM 调用只在生成、再生、翻译、YouTube transcript 提取等明确动作时发生。
- 会话必须有 `sessionId`；缺失时展示空状态并给出返回首页/创建会话入口。
- 生成期间锁定普通发送，避免并发写入同一 dialogue branch。
- 不支持的 legacy 数据或命令应显式失败；不要把失败吞成静默兜底。
- `/test-script-runner` 是内部验证入口，不应进入普通用户导航主路径。

## 5. 附录

- [API Inventory](appendix/api-inventory.md)
- [Enum Dictionary](appendix/enum-dictionary.md)
- [Page Relationships](appendix/page-relationships.md)
- [Slash Command Reference](appendix/slash-command-reference.md)
- [Tools Inventory](appendix/tools-inventory.md)
